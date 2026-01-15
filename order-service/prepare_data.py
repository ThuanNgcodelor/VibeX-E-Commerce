import requests
import json
import base64
import pymysql

# --- CONFIG ---
GATEWAY_URL = "http://localhost:8080"
AUTH_URL  = f"{GATEWAY_URL}/auth-service/v1/auth"
USER_URL  = f"{GATEWAY_URL}/user-service/v1/user"
STOCK_URL = f"{GATEWAY_URL}/stock-service/v1/stock/cart"

DB_CONFIG = {
    "host": "localhost",
    "user": "sa",
    "password": "Thuan@417",
    "database": "shopee",
    "port": 3306
}

USERS_COUNT = 100
RAW_PASSWORD = "Thuan417"

def decode_jwt_token(token):
    try:
        parts = token.split('.')
        if len(parts) != 3: return None
        payload = parts[1]
        padding = 4 - len(payload) % 4
        if padding != 4: payload += '=' * padding
        decoded = base64.b64decode(payload)
        data = json.loads(decoded)
        return data.get('userId')
    except:
        return None

def fetch_valid_product():
    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT p.id, s.id, s.stock, p.name 
        FROM products p 
        JOIN sizes s ON p.id = s.product_id 
        WHERE s.stock > 1000 
        LIMIT 1
    """)
    row = cursor.fetchone()
    conn.close()
    if row:
        return {"productId": row[0], "sizeId": row[1], "name": row[3]}
    return None

def main():
    print("🚀 PREPARING DATA FOR LOAD TEST...")
    
    product = fetch_valid_product()
    if not product:
        print("❌ No products with enough stock found!")
        return

    print(f"📦 Target Product: {product['name']} (ID: {product['productId']})")

    users_data = []

    # Try multiple passwords
    passwords_to_try = [RAW_PASSWORD, "123456", "password", "admin"]
    
    for i in range(1, USERS_COUNT + 1):
        email = f"thuannguyen{i}@gmail.com"
        
        token = None
        userId = None
        
        # 1. Login with retries
        for pwd in passwords_to_try:
            try:
                # Try Gateway first
                resp = requests.post(f"{AUTH_URL}/login", json={"email": email, "password": pwd}, timeout=5)
                
                # Fallback to Direct Auth Service (8001)
                if resp.status_code == 404:
                     resp = requests.post("http://localhost:8080/v1/auth/login", json={"email": email, "password": pwd}, timeout=5)

                if resp.status_code == 200:
                    data = resp.json()
                    token = data.get("token") or data.get("accessToken")
                    userId = decode_jwt_token(token)
                    # print(f"   ✓ Login success for {email} with pass '{pwd}'")
                    break # Success
                else:
                    # Only print if it's the last attempt or an interesting error
                    if pwd == passwords_to_try[-1]:
                        print(f"⚠️ Login failed for {email} (Status: {resp.status_code}, Resp: {resp.text[:100]})")
            except Exception as e:
                if pwd == passwords_to_try[-1]:
                    print(f"❌ Error login {email}: {e}")

        if not token:
            continue

        # 2. Get Address
        try:
            headers = {"Authorization": f"Bearer {token}"}
            resp_addr = requests.get(f"{USER_URL}/address/getAllAddresses", headers=headers, timeout=5)
            
            # Fallback Direct User Service (8002)
            if resp_addr.status_code == 404:
                resp_addr = requests.get("http://localhost:8080/v1/user/address/getAllAddresses", headers=headers, timeout=5)

            addressId = None
            if resp_addr.status_code == 200 and resp_addr.json():
                addressId = resp_addr.json()[0]["id"]
            
            if not addressId:
                print(f"⚠️ No address for {email}")
                continue
            
            # 3. Add Item (Optimization: Skip actual stock call if we just need valid IDs, 
            # BUT we need a valid cart for Consumer logic? 
            # My 'orderByKafka' removed getCart, but Consumer might need it.
            # Let's add it to be safe.)
            cart_payload = {
                "productId": product["productId"],
                "sizeId": product["sizeId"],
                "quantity": 1,
                "isFlashSale": False
            }
            # Try Gateway -> Fallback Stock (8004 is Stock Service? Usually 8003 or 8004. 
            # Properties file said 8004.)
            try:
                requests.post(f"{STOCK_URL}/item/add", json=cart_payload, headers=headers, timeout=5)
            except: 
                requests.post("http://localhost:8080/v1/stock/cart/item/add", json=cart_payload, headers=headers, timeout=5)

            users_data.append({
                "userId": userId,
                "addressId": addressId,
                "token": token,
                "email": email,
                "targetProduct": product
            })
            
            if len(users_data) % 10 == 0:
                print(f"   ✓ Prepared {len(users_data)} users...")
                
        except Exception as e:
            print(f"❌ Error preparing {email} sequence: {e}")


    # Save to file
    with open("user_data.json", "w") as f:
        json.dump(users_data, f, indent=2)
    
    print(f"\n✅ DATA PREPARATION COMPLETE. Saved {len(users_data)} users to 'user_data.json'.")
    print("👉 Now run 'python attack_checkout.py'")

if __name__ == "__main__":
    main()
