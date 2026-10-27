import sys
import argparse
import asyncio
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient

# Ensure backend root is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.config import settings
from app.services.auth_service import AuthService
from app.schemas.auth import UserCreate, UserRole

async def main():
    parser = argparse.ArgumentParser(description="Create a Wayzo Administrator Account")
    parser.add_argument("--email", required=True, help="Administrator email address")
    parser.add_argument("--password", required=True, help="Administrator password (min 8 characters, letter + number)")
    parser.add_argument("--name", default="System Administrator", help="Administrator full name")

    args = parser.parse_args()

    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[settings.DATABASE_NAME]

    auth_service = AuthService(db)
    user_in = UserCreate(
        email=args.email,
        password=args.password,
        full_name=args.name,
        role=UserRole.ADMIN
    )

    try:
        user = await auth_service.create_user(user_in, created_by="cli_setup")
        print("\n" + "=" * 60)
        print("WAYZO ADMINISTRATOR CREATED SUCCESSFULLY")
        print("=" * 60)
        print(f"User ID   : {user.user_id}")
        print(f"Email     : {user.email}")
        print(f"Name      : {user.full_name}")
        print(f"Role      : {user.role.value}")
        print("=" * 60 + "\n")
    except Exception as e:
        print(f"\n[ERROR] Failed to create administrator: {e}\n", file=sys.stderr)
        sys.exit(1)
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())
