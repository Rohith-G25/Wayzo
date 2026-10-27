import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
import bcrypt
import jwt
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config import settings
from app.schemas.auth import (
    UserRole,
    UserCreate,
    UserLogin,
    UserResponse,
    TokenResponse,
    UserUpdate
)

logger = logging.getLogger("smartroadai.auth")

class AuthService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.users_col = db["users"]

    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a plaintext password using bcrypt with salt rounds."""
        pwd_bytes = password.encode("utf-8")
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify plaintext password against bcrypt hash."""
        try:
            return bcrypt.checkpw(
                plain_password.encode("utf-8"),
                hashed_password.encode("utf-8")
            )
        except Exception as e:
            logger.warning(f"Password verification failure: {e}")
            return False

    @staticmethod
    def create_access_token(data: Dict[str, Any]) -> str:
        """Generate short-lived JWT access token."""
        to_encode = data.copy()
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "type": "access"
        })
        return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    @staticmethod
    def create_refresh_token(data: Dict[str, Any]) -> tuple[str, str]:
        """Generate long-lived JWT refresh token with unique jti tracking."""
        to_encode = data.copy()
        jti = uuid.uuid4().hex
        now = datetime.now(timezone.utc)
        expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        to_encode.update({
            "jti": jti,
            "exp": expire,
            "iat": now,
            "type": "refresh"
        })
        token = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
        return token, jti

    @staticmethod
    def create_media_ticket(user_id: str, email: str = "") -> str:
        """Generate short-lived (60s) single-purpose media ticket JWT."""
        expire = datetime.now(timezone.utc) + timedelta(seconds=60)
        payload = {
            "sub": user_id,
            "email": email,
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "type": "media_ticket"
        }
        return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    @staticmethod
    def decode_token(token: str, expected_type: str = "access") -> Dict[str, Any]:
        """Decode and validate JWT token signature, expiration, and token type."""
        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM]
            )
            token_type = payload.get("type")
            if token_type != expected_type:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Invalid token type. Expected {expected_type} token."
                )
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired. Please authenticate again."
            )
        except jwt.PyJWTError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid authentication token: {str(e)}"
            )

    async def create_user(self, user_in: UserCreate, created_by: Optional[str] = None) -> UserResponse:
        """Create a new user with hashed password and role."""
        normalized_email = user_in.email.strip().lower()

        # Check existing user
        existing = await self.users_col.find_one({"email": normalized_email})
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email address already exists."
            )

        user_id = f"USR-{uuid.uuid4().hex[:8].upper()}"
        now_iso = datetime.now(timezone.utc).isoformat()

        user_doc = {
            "user_id": user_id,
            "email": normalized_email,
            "full_name": user_in.full_name.strip(),
            "role": user_in.role.value,
            "hashed_password": self.hash_password(user_in.password),
            "is_active": True,
            "created_at": now_iso,
            "created_by": created_by,
            "last_login_at": None,
            "failed_login_attempts": 0,
            "lockout_until": None
        }

        await self.users_col.insert_one(user_doc)
        logger.info(f"User created successfully: {user_id} ({normalized_email}) with role '{user_in.role.value}'")

        return UserResponse(
            user_id=user_id,
            email=normalized_email,
            full_name=user_in.full_name.strip(),
            role=user_in.role,
            is_active=True,
            created_at=now_iso,
            last_login_at=None
        )

    async def authenticate_user(self, credentials: UserLogin) -> TokenResponse:
        """Authenticate user with brute-force lockout protection and return JWT tokens."""
        normalized_email = credentials.email.strip().lower()
        now = datetime.now(timezone.utc)

        user = await self.users_col.find_one({"email": normalized_email})
        if not user:
            # Generic error to prevent user enumeration
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password."
            )

        # Check if user account is active
        if not user.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account has been deactivated. Please contact an administrator."
            )

        # Check brute force lockout
        lockout_until_str = user.get("lockout_until")
        if lockout_until_str:
            try:
                lockout_until = datetime.fromisoformat(lockout_until_str)
                if now < lockout_until:
                    remaining_mins = max(1, int((lockout_until - now).total_seconds() / 60))
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=f"Account locked due to multiple failed login attempts. Try again in {remaining_mins} minute(s)."
                    )
            except (ValueError, TypeError):
                pass

        # Verify password
        if not self.verify_password(credentials.password, user.get("hashed_password", "")):
            failed_attempts = user.get("failed_login_attempts", 0) + 1
            updates = {"failed_login_attempts": failed_attempts}

            if failed_attempts >= settings.MAX_FAILED_LOGIN_ATTEMPTS:
                lockout_time = now + timedelta(minutes=settings.ACCOUNT_LOCKOUT_MINUTES)
                updates["lockout_until"] = lockout_time.isoformat()
                logger.warning(f"Account {normalized_email} locked until {lockout_time} due to {failed_attempts} failed attempts")
            
            await self.users_col.update_one({"_id": user["_id"]}, {"$set": updates})

            remaining = max(0, settings.MAX_FAILED_LOGIN_ATTEMPTS - failed_attempts)
            if remaining == 0:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Too many failed login attempts. Account locked for {settings.ACCOUNT_LOCKOUT_MINUTES} minutes."
                )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid email or password. {remaining} attempt(s) remaining before lockout."
            )

        # Successful login: reset failed attempts & update last_login
        now_iso = now.isoformat()
        await self.users_col.update_one(
            {"_id": user["_id"]},
            {"$set": {
                "failed_login_attempts": 0,
                "lockout_until": None,
                "last_login_at": now_iso
            }}
        )

        user_id = user["user_id"]
        role = user.get("role", UserRole.INSPECTOR.value)

        token_payload = {
            "sub": user_id,
            "email": user["email"],
            "role": role,
            "name": user.get("full_name", "")
        }

        access_token = self.create_access_token(token_payload)
        refresh_token, jti = self.create_refresh_token(token_payload)

        # Store active refresh token in MongoDB collection
        if self.db is not None:
            await self.db["refresh_tokens"].insert_one({
                "jti": jti,
                "user_id": user_id,
                "created_at": now_iso,
                "expires_at": (now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)).isoformat(),
                "revoked": False
            })

        user_resp = UserResponse(
            user_id=user_id,
            email=user["email"],
            full_name=user.get("full_name", ""),
            role=UserRole(role),
            is_active=user.get("is_active", True),
            created_at=user.get("created_at", now_iso),
            last_login_at=now_iso
        )

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
            user=user_resp
        )

    async def refresh_session(self, refresh_token: str) -> TokenResponse:
        """
        Renew access token using valid refresh token.
        Enforces Refresh Token Rotation and detects token replay/reuse.
        """
        payload = self.decode_token(refresh_token, expected_type="refresh")
        user_id = payload.get("sub")
        jti = payload.get("jti")

        if not jti:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Legacy or malformed refresh token without token ID."
            )

        # Check token status in database
        if self.db is not None:
            token_doc = await self.db["refresh_tokens"].find_one({"jti": jti})
            if not token_doc:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Refresh token not recognized or already discarded."
                )

            if token_doc.get("revoked", False):
                # Token reuse detected! Potential breach: revoke all tokens for this user
                logger.warning(f"SECURITY ALERT: Refresh token reuse detected for user {user_id}! Revoking all sessions.")
                await self.db["refresh_tokens"].update_many(
                    {"user_id": user_id},
                    {"$set": {"revoked": True, "revoked_at": datetime.now(timezone.utc).isoformat()}}
                )
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Refresh token has been revoked. Security alert: please log in again."
                )

            # Mark previous refresh token as rotated/revoked
            now = datetime.now(timezone.utc)
            now_iso = now.isoformat()
            await self.db["refresh_tokens"].update_one(
                {"jti": jti},
                {"$set": {"revoked": True, "rotated_at": now_iso}}
            )
        else:
            now = datetime.now(timezone.utc)
            now_iso = now.isoformat()

        user = await self.users_col.find_one({"user_id": user_id})
        if not user or not user.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User session invalid or account inactive."
            )

        token_payload = {
            "sub": user["user_id"],
            "email": user["email"],
            "role": user.get("role", UserRole.INSPECTOR.value),
            "name": user.get("full_name", "")
        }

        new_access_token = self.create_access_token(token_payload)
        new_refresh_token, new_jti = self.create_refresh_token(token_payload)

        # Persist new rotated refresh token
        if self.db is not None:
            await self.db["refresh_tokens"].insert_one({
                "jti": new_jti,
                "user_id": user["user_id"],
                "created_at": now_iso,
                "expires_at": (now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)).isoformat(),
                "revoked": False
            })

        user_resp = UserResponse(
            user_id=user["user_id"],
            email=user["email"],
            full_name=user.get("full_name", ""),
            role=UserRole(user.get("role", UserRole.INSPECTOR.value)),
            is_active=user.get("is_active", True),
            created_at=user.get("created_at", ""),
            last_login_at=user.get("last_login_at")
        )

        return TokenResponse(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
            expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
            user=user_resp
        )

    async def logout_user(self, refresh_token: Optional[str] = None, user_id: Optional[str] = None) -> bool:
        """Revoke refresh token on logout."""
        now_iso = datetime.now(timezone.utc).isoformat()
        if self.db is None:
            return True

        if refresh_token:
            try:
                payload = self.decode_token(refresh_token, expected_type="refresh")
                jti = payload.get("jti")
                if jti:
                    await self.db["refresh_tokens"].update_one(
                        {"jti": jti},
                        {"$set": {"revoked": True, "revoked_at": now_iso}}
                    )
            except Exception as e:
                logger.warning(f"Could not parse refresh token for revocation: {e}")

        if user_id:
            await self.db["refresh_tokens"].update_many(
                {"user_id": user_id, "revoked": False},
                {"$set": {"revoked": True, "revoked_at": now_iso}}
            )
        return True

    async def get_user_by_id(self, user_id: str) -> Optional[UserResponse]:
        """Fetch single user by user_id."""
        user = await self.users_col.find_one({"user_id": user_id})
        if not user:
            return None
        return UserResponse(
            user_id=user["user_id"],
            email=user["email"],
            full_name=user.get("full_name", ""),
            role=UserRole(user.get("role", UserRole.INSPECTOR.value)),
            is_active=user.get("is_active", True),
            created_at=user.get("created_at", ""),
            last_login_at=user.get("last_login_at")
        )

    async def list_users(self) -> List[UserResponse]:
        """List all users sorted by creation date."""
        cursor = self.users_col.find({}).sort("created_at", -1)
        users = []
        async for doc in cursor:
            users.append(
                UserResponse(
                    user_id=doc["user_id"],
                    email=doc["email"],
                    full_name=doc.get("full_name", ""),
                    role=UserRole(doc.get("role", UserRole.INSPECTOR.value)),
                    is_active=doc.get("is_active", True),
                    created_at=doc.get("created_at", ""),
                    last_login_at=doc.get("last_login_at")
                )
            )
        return users

    async def update_user(self, user_id: str, updates: UserUpdate) -> UserResponse:
        """Update user profile, role, status, or password."""
        user = await self.users_col.find_one({"user_id": user_id})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User {user_id} not found."
            )

        update_dict: Dict[str, Any] = {}
        if updates.full_name is not None:
            update_dict["full_name"] = updates.full_name.strip()
        if updates.role is not None:
            update_dict["role"] = updates.role.value
        if updates.is_active is not None:
            update_dict["is_active"] = updates.is_active
        if updates.password is not None:
            update_dict["hashed_password"] = self.hash_password(updates.password)

        if update_dict:
            await self.users_col.update_one({"user_id": user_id}, {"$set": update_dict})

        updated = await self.users_col.find_one({"user_id": user_id})
        return UserResponse(
            user_id=updated["user_id"],
            email=updated["email"],
            full_name=updated.get("full_name", ""),
            role=UserRole(updated.get("role", UserRole.INSPECTOR.value)),
            is_active=updated.get("is_active", True),
            created_at=updated.get("created_at", ""),
            last_login_at=updated.get("last_login_at")
        )

    async def delete_user(self, user_id: str, requesting_user_id: str) -> bool:
        """Delete user account (cannot delete own account)."""
        if user_id == requesting_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Administrators cannot delete their own active account."
            )
        res = await self.users_col.delete_one({"user_id": user_id})
        if res.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User {user_id} not found."
            )
        return True
