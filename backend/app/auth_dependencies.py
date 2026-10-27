from fastapi import Depends, HTTPException, status, Query, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, List
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.dependencies import get_db
from app.services.auth_service import AuthService
from app.schemas.auth import UserRole

# HTTP Bearer scheme (auto_error=False so we can also check query token if needed)
security_bearer = HTTPBearer(auto_error=False)

def get_auth_service(db: AsyncIOMotorDatabase = Depends(get_db)) -> AuthService:
    """Dependency injection for AuthService."""
    return AuthService(db)

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> dict:
    """
    Authenticate request strictly via Bearer Authorization header.
    Access tokens are never accepted in query parameters to prevent leakage in URLs, browser history, and server logs.
    """
    token = None
    if credentials and credentials.scheme.lower() == "bearer":
        token = credentials.credentials

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token in the Authorization header.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    auth_service = AuthService(db)
    payload = auth_service.decode_token(token, expected_type="access")
    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token: missing subject identity.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user = await db["users"].find_one({"user_id": user_id})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user account not found or has been deleted.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact an administrator."
        )

    return user

def require_roles(*allowed_roles: UserRole):
    """Factory creating a role-enforcement dependency."""
    allowed_values = [r.value for r in allowed_roles]

    async def role_checker(current_user: dict = Depends(get_current_user)) -> dict:
        user_role = current_user.get("role")
        if user_role not in allowed_values:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: Insufficient permissions. Required role: {', '.join(allowed_values)}"
            )
        return current_user

    return role_checker

# Standardized Role Dependencies
require_admin = require_roles(UserRole.ADMIN)
require_inspector = require_roles(UserRole.ADMIN, UserRole.INSPECTOR)
require_maintenance = require_roles(UserRole.ADMIN, UserRole.MAINTENANCE)
require_authenticated = get_current_user

async def verify_media_access(
    request: Request,
    ticket: Optional[str] = Query(None, description="Short-lived (60s) single-purpose media ticket"),
    token: Optional[str] = Query(None, description="Prohibited query parameter for access tokens"),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> dict:
    """
    Authenticate media asset requests.
    Supports:
    1. HTTP Authorization: Bearer <access_token> header (standard API calls/blob requests)
    2. ?ticket=<media_ticket> (ephemeral 60s scoped JWT for media previews/video streams)
    Explicitly rejects ?token=<access_token> in URLs to prevent token leakage in browser history/logs.
    """
    if token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Query parameter 'token' is prohibited for security. Use 'Authorization: Bearer <token>' header or request a short-lived media ticket via POST /api/v1/media/ticket."
        )

    auth_service = AuthService(db)

    # 1. Bearer token in Authorization header
    if credentials and credentials.scheme.lower() == "bearer":
        payload = auth_service.decode_token(credentials.credentials, expected_type="access")
        user_id = payload.get("sub")
        user = await db["users"].find_one({"user_id": user_id})
        if not user or not user.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User session invalid or deactivated."
            )
        return user

    # 2. Ephemeral media ticket in query parameter
    if ticket:
        payload = auth_service.decode_token(ticket, expected_type="media_ticket")
        user_id = payload.get("sub")
        user = await db["users"].find_one({"user_id": user_id})
        if not user or not user.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User session invalid or deactivated."
            )
        return user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required to view media. Provide Bearer token in header or valid ?ticket= parameter.",
        headers={"WWW-Authenticate": "Bearer"}
    )
