from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.dependencies import get_db
from app.auth_dependencies import get_auth_service, get_current_user, require_admin
from app.services.auth_service import AuthService
from app.schemas.auth import (
    UserCreate,
    UserLogin,
    UserResponse,
    TokenResponse,
    RefreshTokenRequest,
    UserUpdate,
    UserRole,
    LogoutRequest
)

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=TokenResponse)
async def login(
    credentials: UserLogin,
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Authenticate with email and password.
    Returns short-lived access token, refresh token, and user profile.
    Includes brute-force lockout protection.
    """
    return await auth_service.authenticate_user(credentials)

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: RefreshTokenRequest,
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Exchange a valid refresh token for a newly issued access token with rotation.
    """
    return await auth_service.refresh_session(request.refresh_token)

@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    request: LogoutRequest = LogoutRequest(),
    current_user: dict = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Revoke refresh token and terminate active session.
    """
    await auth_service.logout_user(
        refresh_token=request.refresh_token,
        user_id=current_user.get("user_id")
    )
    return {"success": True, "message": "Successfully logged out."}

@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve profile details of currently authenticated user.
    """
    return UserResponse(
        user_id=current_user["user_id"],
        email=current_user["email"],
        full_name=current_user.get("full_name", ""),
        role=UserRole(current_user.get("role", UserRole.INSPECTOR.value)),
        is_active=current_user.get("is_active", True),
        created_at=current_user.get("created_at", ""),
        last_login_at=current_user.get("last_login_at")
    )

@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user_by_admin(
    user_in: UserCreate,
    current_user: dict = Depends(require_admin),
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Create a new user account with specified role (Admin only).
    """
    return await auth_service.create_user(user_in, created_by=current_user.get("user_id"))

@router.get("/users", response_model=List[UserResponse])
async def list_all_users_by_admin(
    current_user: dict = Depends(require_admin),
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    List all user accounts in the registry (Admin only).
    """
    return await auth_service.list_users()

@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user_by_admin(
    user_id: str,
    updates: UserUpdate,
    current_user: dict = Depends(require_admin),
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Update user profile, change role, or toggle active status (Admin only).
    """
    return await auth_service.update_user(user_id, updates)

@router.delete("/users/{user_id}", status_code=status.HTTP_200_OK)
async def delete_user_by_admin(
    user_id: str,
    current_user: dict = Depends(require_admin),
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Delete a user account. Cannot delete own account (Admin only).
    """
    await auth_service.delete_user(user_id, requesting_user_id=current_user.get("user_id"))
    return {"success": True, "message": f"User {user_id} deleted successfully."}

@router.post("/setup-initial-admin", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def setup_initial_admin(
    user_in: UserCreate,
    auth_service: AuthService = Depends(get_auth_service),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Bootstrap the very first Administrator account if the database contains zero users.
    Permanently disabled once any user exists.
    """
    total_users = await db["users"].count_documents({})
    if total_users > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Initial admin setup is permanently disabled because users already exist."
        )
    
    # Force role to admin for the bootstrap user
    user_in.role = UserRole.ADMIN
    return await auth_service.create_user(user_in, created_by="bootstrap")
