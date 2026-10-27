import os
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
import jwt
from starlette.testclient import TestClient

# Ensure backend root is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.main import app
from app.config import settings
from app.services.auth_service import AuthService

def run_auth_tests():
    print("=" * 60)
    print("STARTING WAYZO AUTHENTICATION & AUTHORIZATION TEST SUITE")
    print("=" * 60)

    with TestClient(app) as client:
        # 1. Clean test users from previous test runs if needed
        # Test 1: Check Public Health Endpoint (remains accessible without auth)
        print("\n--- TEST 1: Public Health Check ---")
        health_res = client.get("/health")
        assert health_res.status_code == 200
        print("✓ Public Health Check Passed (No Auth Required)")

        # Test 2: Unauthenticated Access to Protected Endpoints (Expect 401)
        print("\n--- TEST 2: Unauthenticated Access Blocked (401 Unauthorized) ---")
        unauth_endpoints = [
            ("GET", "/api/v1/auth/me"),
            ("GET", "/api/v1/detect/history"),
            ("GET", "/api/v1/detect/geo-inspections"),
            ("GET", "/api/v1/maintenance"),
            ("GET", "/api/v1/statistics"),
            ("GET", "/api/v1/reports/summary"),
            ("GET", "/api/v1/reports/inspection/DET-SAMPLE-1"),
            ("GET", "/api/v1/media/images/test.jpg"),
        ]
        for method, endpoint in unauth_endpoints:
            if method == "GET":
                res = client.get(endpoint)
            assert res.status_code == 401, f"Expected 401 for {endpoint}, got {res.status_code}"
            assert "authentication required" in res.json().get("detail", "").lower()
        print(f"✓ All {len(unauth_endpoints)} Protected Endpoints Successfully Rejected Unauthenticated Requests (401)")

        # Test 3: Bootstrap Initial Administrator (or CLI creation)
        print("\n--- TEST 3: Initial Administrator Creation ---")
        admin_email = f"admin_test_{int(time.time())}@wayzo.gov"
        admin_password = "AdminSecurePass123!"
        admin_payload = {
            "email": admin_email,
            "password": admin_password,
            "full_name": "Test Administrator",
            "role": "admin"
        }
        # Try initial admin setup (or fallback to login if users already exist in persistent DB)
        setup_res = client.post("/api/v1/auth/setup-initial-admin", json=admin_payload)
        if setup_res.status_code == 201:
            print(f"✓ Initial Administrator Bootstrapped via setup endpoint: {admin_email}")
        else:
            admin_email = "admin@wayzo.gov"
            admin_password = "AdminPass123!"
            print(f"✓ Using Established System Administrator: {admin_email}")

        # Test 4: Password Hashing Verification
        print("\n--- TEST 4: Password Hashing & Bcrypt Security ---")
        assert AuthService.verify_password(admin_password, AuthService.hash_password(admin_password)) is True
        assert AuthService.verify_password("WrongPassword123!", AuthService.hash_password(admin_password)) is False
        hashed = AuthService.hash_password(admin_password)
        assert hashed.startswith("$2b$") or hashed.startswith("$2a$")
        assert admin_password not in hashed
        print("✓ Bcrypt Hashing Verified: Valid salt rounds, one-way hash integrity confirmed")

        # Test 5: Successful Administrator Login (Receive JWT Access & Refresh Tokens)
        print("\n--- TEST 5: Successful Administrator Login ---")
        login_res = client.post(
            "/api/v1/auth/login",
            json={"email": admin_email, "password": admin_password}
        )
        assert login_res.status_code == 200
        login_data = login_res.json()
        assert "access_token" in login_data
        assert "refresh_token" in login_data
        assert login_data["token_type"] == "bearer"
        assert login_data["user"]["role"] == "admin"
        admin_access_token = login_data["access_token"]
        admin_refresh_token = login_data["refresh_token"]
        admin_headers = {"Authorization": f"Bearer {admin_access_token}"}
        print(f"✓ Administrator Logged In: Token issued, role='admin', user_id='{login_data['user']['user_id']}'")

        # Test 6: Verify /auth/me Profile for Logged-In Admin
        print("\n--- TEST 6: Authenticated Profile (/auth/me) ---")
        me_res = client.get("/api/v1/auth/me", headers=admin_headers)
        assert me_res.status_code == 200
        me_data = me_res.json()
        assert me_data["email"] == admin_email
        assert me_data["role"] == "admin"
        assert me_data["is_active"] is True
        print(f"✓ Profile Verified: {me_data['full_name']} ({me_data['email']})")

        # Test 7: Admin Creates Inspector and Maintenance Accounts
        print("\n--- TEST 7: Role-Based User Provisioning by Admin ---")
        inspector_email = f"inspector_test_{int(time.time())}@wayzo.gov"
        inspector_password = "InspPassword123!"
        insp_create_res = client.post(
            "/api/v1/auth/users",
            headers=admin_headers,
            json={
                "email": inspector_email,
                "password": inspector_password,
                "full_name": "Field Inspector Roy",
                "role": "inspector"
            }
        )
        assert insp_create_res.status_code == 201
        inspector_user = insp_create_res.json()
        assert inspector_user["role"] == "inspector"
        print(f"✓ Inspector Account Created: {inspector_email} (Role: inspector)")

        maint_email = f"maint_test_{int(time.time())}@wayzo.gov"
        maint_password = "MaintPassword123!"
        maint_create_res = client.post(
            "/api/v1/auth/users",
            headers=admin_headers,
            json={
                "email": maint_email,
                "password": maint_password,
                "full_name": "Crew Supervisor Sharma",
                "role": "maintenance"
            }
        )
        assert maint_create_res.status_code == 201
        maint_user = maint_create_res.json()
        assert maint_user["role"] == "maintenance"
        print(f"✓ Maintenance Account Created: {maint_email} (Role: maintenance)")

        # Login Inspector
        insp_login = client.post(
            "/api/v1/auth/login",
            json={"email": inspector_email, "password": inspector_password}
        ).json()
        insp_headers = {"Authorization": f"Bearer {insp_login['access_token']}"}

        # Login Maintenance
        maint_login = client.post(
            "/api/v1/auth/login",
            json={"email": maint_email, "password": maint_password}
        ).json()
        maint_headers = {"Authorization": f"Bearer {maint_login['access_token']}"}

        # Test 8: Failed Login With Wrong Password
        print("\n--- TEST 8: Failed Login With Invalid Credentials ---")
        bad_login_res = client.post(
            "/api/v1/auth/login",
            json={"email": inspector_email, "password": "WrongPassword123!"}
        )
        assert bad_login_res.status_code == 401
        assert "invalid email or password" in bad_login_res.json()["detail"].lower()
        print("✓ Failed Login Gracefully Handled (401 Unauthorized)")

        # Test 9: Brute-Force Lockout Protection
        print("\n--- TEST 9: Brute-Force Attack Protection (Account Lockout) ---")
        lockout_target_email = f"victim_{int(time.time())}@wayzo.gov"
        client.post(
            "/api/v1/auth/users",
            headers=admin_headers,
            json={
                "email": lockout_target_email,
                "password": "CorrectPass123!",
                "full_name": "Lockout Victim",
                "role": "inspector"
            }
        )
        # Attempt 5 consecutive wrong passwords
        for attempt in range(1, 6):
            fail_res = client.post(
                "/api/v1/auth/login",
                json={"email": lockout_target_email, "password": f"AttackPass_{attempt}"}
            )
            if attempt < 5:
                assert fail_res.status_code == 401
            else:
                assert fail_res.status_code in [401, 429]
        
        # 6th attempt must be locked out with HTTP 429 Too Many Requests
        lockout_res = client.post(
            "/api/v1/auth/login",
            json={"email": lockout_target_email, "password": "CorrectPass123!"}
        )
        assert lockout_res.status_code == 429
        assert "locked" in lockout_res.json()["detail"].lower()
        print("✓ Brute-Force Protection Active: Account locked out after 5 consecutive failed attempts (429)")

        # Test 10: Expired and Malformed Tokens Rejection
        print("\n--- TEST 10: Token Expiration & Malformed Signature Validation ---")
        # Generate expired token
        expired_token = jwt.encode(
            {
                "sub": "USR-EXPIRED",
                "email": "exp@wayzo.gov",
                "role": "inspector",
                "type": "access",
                "exp": datetime.now(timezone.utc) - timedelta(minutes=10)
            },
            settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM
        )
        exp_res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
        assert exp_res.status_code == 401
        assert "expired" in exp_res.json()["detail"].lower()
        print("✓ Expired Token Rejected with 401")

        # Malformed token
        malformed_res = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-real-jwt-token"})
        assert malformed_res.status_code == 401
        print("✓ Malformed Token Rejected with 401")

        # Test 11: Refresh Token Flow, Rotation & Replay Attack Prevention
        print("\n--- TEST 11: Session Renewal, Token Rotation & Replay Prevention ---")
        refresh_res = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": admin_refresh_token}
        )
        assert refresh_res.status_code == 200
        refreshed_data = refresh_res.json()
        assert "access_token" in refreshed_data
        assert "refresh_token" in refreshed_data
        assert refreshed_data["access_token"] != admin_access_token
        new_rotated_refresh = refreshed_data["refresh_token"]
        assert new_rotated_refresh != admin_refresh_token

        # Verify newly refreshed access token works
        fresh_profile = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {refreshed_data['access_token']}"}
        )
        assert fresh_profile.status_code == 200
        print("✓ Token Refresh Flow Succeeded: Fresh access token generated and operational")

        # 11B: Replay Prevention - Re-using the old/rotated refresh token MUST be rejected
        replay_res = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": admin_refresh_token}
        )
        assert replay_res.status_code == 401
        print("✓ Token Rotation & Replay Attack Defense Verified: Old refresh token rejected (401)")

        # 11C: Logout & Token Revocation
        logout_res = client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {refreshed_data['access_token']}"},
            json={"refresh_token": new_rotated_refresh}
        )
        assert logout_res.status_code == 200
        # Post-logout refresh with revoked token MUST be rejected
        post_logout_refresh = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": new_rotated_refresh}
        )
        assert post_logout_refresh.status_code == 401
        print("✓ Logout & Token Revocation Verified: Session terminated and token revoked")

        # Re-login admin for remaining test steps
        relogin = client.post(
            "/api/v1/auth/login",
            json={"email": admin_email, "password": admin_password}
        ).json()
        admin_headers = {"Authorization": f"Bearer {relogin['access_token']}"}

        # Test 12: Role-Based Authorization Checks (Least Privilege)
        print("\n--- TEST 12: RBAC Least-Privilege Permission Checks ---")
        # 12A: Inspector trying to create users (Admin only) -> 403 Forbidden
        insp_forbidden_user = client.post(
            "/api/v1/auth/users",
            headers=insp_headers,
            json={
                "email": "intruder@wayzo.gov",
                "password": "Password123!",
                "full_name": "Intruder",
                "role": "admin"
            }
        )
        assert insp_forbidden_user.status_code == 403
        assert "forbidden" in insp_forbidden_user.json()["detail"].lower()
        print("✓ Inspector Blocked from Admin User Management (403 Forbidden)")

        # 12B: Inspector trying to generate executive summary financial report (Admin only) -> 403 Forbidden
        insp_forbidden_summary = client.get("/api/v1/reports/summary", headers=insp_headers)
        assert insp_forbidden_summary.status_code == 403
        print("✓ Inspector Blocked from Executive Financial Summary (403 Forbidden)")

        # 12C: Admin CAN generate executive summary report -> 200 OK
        admin_summary_res = client.get("/api/v1/reports/summary", headers=admin_headers)
        assert admin_summary_res.status_code == 200
        assert admin_summary_res.content.startswith(b"%PDF")
        print("✓ Administrator Authorized for Executive Summary Report (200 OK)")

        # 12D: Maintenance staff trying to run image damage inspection -> 403 Forbidden
        maint_forbidden_detect = client.post(
            "/api/v1/detect/image",
            headers=maint_headers,
            files={"file": ("fake.jpg", b"fakebytes", "image/jpeg")}
        )
        assert maint_forbidden_detect.status_code == 403
        print("✓ Maintenance Staff Blocked from AI Detection Inference (403 Forbidden)")

        # 12E: Inspector CAN create maintenance work orders -> 201 Created
        insp_create_wo = client.post(
            "/api/v1/maintenance",
            headers=insp_headers,
            json={
                "road_name": "Auth Security Sector, Km 10",
                "priority": "Medium",
                "damage_category": "Pothole",
                "description": "Logged by verified inspector",
                "latitude": 13.0827,
                "longitude": 80.2707
            }
        )
        assert insp_create_wo.status_code == 201
        created_wo_id = insp_create_wo.json()["work_order_id"]
        print(f"✓ Inspector Authorized to Log Work Order: {created_wo_id} (201 Created)")

        # 12F: Inspector trying to patch maintenance work order lifecycle status -> 403 Forbidden
        insp_forbidden_patch = client.patch(
            f"/api/v1/maintenance/{created_wo_id}/status",
            headers=insp_headers,
            json={"status": "Completed"}
        )
        assert insp_forbidden_patch.status_code == 403
        print("✓ Inspector Blocked from Modifying Maintenance Lifecycle Status (403 Forbidden)")

        # 12G: Maintenance staff CAN patch work order lifecycle status -> 200 OK
        maint_patch_ok = client.patch(
            f"/api/v1/maintenance/{created_wo_id}/status",
            headers=maint_headers,
            json={"status": "Assigned", "notes": "Assigned to maintenance squad"}
        )
        assert maint_patch_ok.status_code == 200
        assert maint_patch_ok.json()["status"] == "Assigned"
        print(f"✓ Maintenance Staff Authorized to Update Status: {created_wo_id} -> Assigned (200 OK)")

        # Test 13: Protected Media Endpoint, Media Tickets, Static Mount Leak Defense, and Path Traversal Prevention
        print("\n--- TEST 13: Protected Media Access & Path Traversal Prevention ---")
        # Create a sample test image in uploads/images
        test_media_name = "security_test.jpg"
        test_media_path = settings.upload_absolute_dir / "images" / test_media_name
        test_media_path.parent.mkdir(parents=True, exist_ok=True)
        with open(test_media_path, "wb") as f:
            f.write(b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xFF\xDB\x00C")

        # 13A: Unauthenticated media request -> 401
        media_unauth = client.get(f"/api/v1/media/images/{test_media_name}")
        assert media_unauth.status_code == 401

        # 13B: Authenticated media request with Bearer header -> 200
        media_auth_hdr = client.get(f"/api/v1/media/images/{test_media_name}", headers=insp_headers)
        assert media_auth_hdr.status_code == 200
        assert media_auth_hdr.headers.get("content-type") == "image/jpeg"

        # 13C: Query string ?token= parameter is PROHIBITED to prevent token leakage in logs/history -> 401
        media_auth_query = client.get(f"/api/v1/media/images/{test_media_name}?token={insp_login['access_token']}")
        assert media_auth_query.status_code == 401
        assert "prohibited" in media_auth_query.json().get("detail", "").lower()

        # 13D: Scoped, ephemeral 60-second media ticket generation
        ticket_res = client.post("/api/v1/media/ticket", headers=insp_headers)
        assert ticket_res.status_code == 200
        media_ticket = ticket_res.json()["ticket"]
        assert ticket_res.json()["expires_in_seconds"] == 60

        # 13E: Media request using short-lived ?ticket= parameter -> 200
        media_ticket_ok = client.get(f"/api/v1/media/images/{test_media_name}?ticket={media_ticket}")
        assert media_ticket_ok.status_code == 200

        # 13F: Public static file mount leak prevention: unauthenticated access to /uploads/images/... MUST return 401
        uploads_unauth = client.get(f"/uploads/images/{test_media_name}")
        assert uploads_unauth.status_code == 401
        uploads_auth = client.get(f"/uploads/images/{test_media_name}", headers=insp_headers)
        assert uploads_auth.status_code == 200
        print("✓ Public Static Leak Closed: Unauthenticated requests to /uploads/ are blocked (401)")

        # 13G: Path traversal defense (test direct attempt and encoded path traversal)
        from app.routes.media import serve_media_file
        from fastapi import HTTPException
        try:
            serve_media_file("../../app/config.py")
            assert False, "Path traversal should have triggered HTTPException 403!"
        except HTTPException as exc:
            assert exc.status_code == 403
            assert "Path traversal detected" in exc.detail
        
        # Test HTTP layer normalization / blocking
        traversal_http = client.get("/api/v1/media/%2e%2e/%2e%2e/app/config.py", headers=admin_headers)
        assert traversal_http.status_code in [403, 404]
        print("✓ Protected Media Verified: Token rotation, media tickets, and path traversal defense confirmed")

        # Clean up sample test media
        if test_media_path.exists():
            try:
                test_media_path.unlink()
            except OSError:
                pass

        # Test 14: Self-Deletion Prevention by Admin
        print("\n--- TEST 14: Administrative Guardrails ---")
        admin_id = me_data["user_id"]
        self_del_res = client.delete(f"/api/v1/auth/users/{admin_id}", headers=admin_headers)
        assert self_del_res.status_code == 400
        assert "cannot delete their own" in self_del_res.json()["detail"].lower()
        print("✓ Self-Deletion Prevention Confirmed: Admin cannot delete their own active account")

        # Admin deletes a disposable user
        del_user_res = client.delete(f"/api/v1/auth/users/{inspector_user['user_id']}", headers=admin_headers)
        assert del_user_res.status_code == 200
        print(f"✓ Admin Deleted Account: {inspector_user['user_id']}")

    print("\n" + "=" * 60)
    print("ALL 14 AUTHENTICATION & AUTHORIZATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_auth_tests()
