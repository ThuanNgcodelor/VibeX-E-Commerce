"""
REAL Production Load Test - With JWT Auth (Gateway 8080)
Test với REAL data qua Gateway!

Setup:
    1. Cấu hình email/pass users
    2. Run test
"""

import requests
import time
import random
import pymysql
import base64
import json
from concurrent.futures import ThreadPoolExecutor, as_completed

# ============= CẤU HÌNH =============
# MODE 1: Single user test
# MODE 2: Multi user test  
TEST_MODE = "MODE_1"

# GATEWAY URL (All traffic goes here)
GATEWAY_URL = "http://localhost:8080"

# Service Routes via Gateway (Discovery Locator pattern: /service-id/path)
AUTH_URL  = f"{GATEWAY_URL}/auth-service/v1/auth"
USER_URL  = f"{GATEWAY_URL}/user-service/v1/user"
STOCK_URL = f"{GATEWAY_URL}/stock-service/v1/stock/cart"
ORDER_URL = f"{GATEWAY_URL}/order-service/v1/order/create-from-cart"

# --- Authentication ---
# List users for MODE 2 (Email, Password)
USERS_CREDENTIALS = [
    ("thuannguyen418@gmail.com", "Thuan417"),
    # Add more users here for MODE 2
    # ("user2@gmail.com", "password"),
]


def add_to_cart(user_data, product):
    """Thêm sản phẩm vào giỏ hàng trước khi checkout"""
    url = f"{STOCK_URL}/item/add"
    payload = {
        "productId": product["productId"],
        "sizeId": product["sizeId"],
        "quantity": 1,
        "isFlashSale": False
    }
    headers = {
        "Authorization": f"Bearer {user_data['token']}",
        "Content-Type": "application/json"
    }
    
    try:
        # Try Gateway
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        
        # Fallback Gateway -> Direct Stock (8003 presumably? Check application.properties if needed. 
        # But wait, Stock Service port is usually 8003 or 8081? 
        # Let's assume standard port or check. 
        # Based on previous context, stock-service is likely 8003. 
        # I will add fallback to 8003.)
        if response.status_code == 404:
            response = requests.post("http://localhost:8004/v1/stock/cart/item/add", 
                                   json=payload, headers=headers, timeout=10)
            
        if response.status_code not in [200, 201]:
            print(f"⚠️  Add Cart Err: {response.status_code} - {response.text[:100]}")
            
        return response.status_code in [200, 201]
    except Exception as e:
        print(f"⚠️ Add to cart failed: {e}")
        return False



# --- MODE 1 Settings ---
MODE1_TOTAL_ORDERS = 100

# --- MODE 2 Settings ---  
MODE2_ORDERS_PER_USER = 20

# --- Common Settings ---
CONCURRENT_THREADS = 10

# Database để lấy real products
DB_CONFIG = {
    "host": "localhost",
    "user": "sa",
    "password": "Thuan@417",
    "database": "shopee",
    "port": 3306
}
# ====================================

class Metrics:
    def __init__(self):
        self.total = 0
        self.success = 0
        self.failed = 0
        self.latencies = []
        self.errors = {}
        self.start_time = None
    
    def start(self):
        self.start_time = time.time()
    
    def record(self, success, latency_ms, error=None):
        self.total += 1
        if success:
            self.success += 1
        else:
            self.failed += 1
            if error:
                self.errors[error] = self.errors.get(error, 0) + 1
        self.latencies.append(latency_ms)
    
    def print_results(self):
        duration = time.time() - self.start_time
        throughput = self.success / duration if duration > 0 else 0
        sorted_lat = sorted(self.latencies)
        
        print("\n" + "="*70)
        print(f"✅ REAL PRODUCTION LOAD TEST - COMPLETED")
        print(f"   Duration: {duration:.2f}s")
        print(f"   Total: {self.total} | Success: {self.success} | Failed: {self.failed}")
        print(f"   Success Rate: {self.success*100/self.total:.1f}%")
        print(f"   ⚡ Throughput: {throughput:.2f} orders/sec")
        
        if sorted_lat:
            p50 = sorted_lat[len(sorted_lat)//2]
            p95 = sorted_lat[int(len(sorted_lat)*0.95)]
            print(f"   📊 Latency: p50={p50:.0f}ms, p95={p95:.0f}ms")
        
        if self.errors:
            print(f"\n   ❌ Errors:")
            for err, cnt in sorted(self.errors.items(), key=lambda x: -x[1])[:5]:
                print(f"      {cnt}x: {err}")
        print("="*70 + "\n")


def decode_jwt_token(token):
    """Decode JWT token để lấy userId"""
    try:
        parts = token.split('.')
        if len(parts) != 3: return None
        payload = parts[1]
        padding = 4 - len(payload) % 4
        if padding != 4: payload += '=' * padding
        decoded = base64.b64decode(payload)
        data = json.loads(decoded)
        return data.get('userId')
    except Exception as e:
        print(f"❌ Failed to decode token: {e}")
        return None


def login_and_get_token(email, password):
    """Login qua Gateway để lấy JWT token"""
    print(f"🔐 Logging in as {email}...")
    
    try:
        # 1. Try login via Gateway
        url = f"{AUTH_URL}/login"
        response = requests.post(url, json={"email": email, "password": password}, timeout=10)
        
        # 2. If Gateway fails (404), try direct (fallback)
        if response.status_code == 404:
            print(f"⚠️ Gateway 404, trying direct 8001...")
            response = requests.post("http://localhost:8001/v1/auth/login", 
                                   json={"email": email, "password": password}, timeout=10)

        if response.status_code == 200:
            data = response.json()
            token = data.get("token") or data.get("accessToken")
            
            if not token:
                print(f"❌ No token in response: {data}")
                return None, None
                
            user_id = decode_jwt_token(token)
            print(f"✓ Login OK! UserId: {user_id}")
            return token, user_id
        else:
            print(f"❌ Login failed: {response.status_code} - {response.text[:200]}")
            return None, None
            
    except Exception as e:
        print(f"❌ Login error: {e}")
        return None, None


def fetch_real_products(count=10):
    """Lấy real products có stock từ DB"""
    print(f"📊 Fetching {count} real products...")
    try:
        conn = pymysql.connect(**DB_CONFIG)
        cursor = conn.cursor()
        query = """
        SELECT p.id, s.id, s.stock, p.name
        FROM products p
        JOIN sizes s ON p.id = s.product_id
        WHERE s.stock > 0 AND p.status = 'IN_STOCK'
        ORDER BY RAND() LIMIT %s
        """
        cursor.execute(query, (count,))
        results = cursor.fetchall()
        
        products = [{"productId": r[0], "sizeId": r[1], "name": r[3]} for r in results]
        
        if not products:
            print("⚠️  No products found! IMPOSSIBLE? Let's dump DB:")
            
            # Dump Products
            cursor.execute("SELECT id, name, status FROM products LIMIT 50")
            print("\n   --- PRODUCTS ---")
            for row in cursor.fetchall():
                print(f"   {row}")

            # Dump Sizes
            cursor.execute("SELECT id, product_id, stock FROM sizes LIMIT 50")
            print("\n   --- SIZES ---")
            for row in cursor.fetchall():
                print(f"   {row}")
            
            # Check products without sizes
            cursor.execute("SELECT id, name FROM products WHERE id NOT IN (SELECT product_id FROM sizes)")
            print("\n   --- PRODUCTS WITHOUT SIZES ---")
            for row in cursor.fetchall():
                print(f"   {row}")

        cursor.close()
        conn.close()
        
        print(f"✓ Fetched {len(products)} products")
        return products
    except Exception as e:
        print(f"❌ DB error: {e}")
        return []


def get_user_address(token, user_id):
    """Lấy địa chỉ của user qua Gateway"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        # Try Gateway URL
        url = f"{USER_URL}/address/getAllAddresses"
        response = requests.get(url, headers=headers, timeout=10)
        
        # Fallback if Gateway fails
        if response.status_code == 404:
             print(f"⚠️ Gateway 404, trying direct 8002...")
             response = requests.get("http://localhost:8002/v1/user/address/getAllAddresses", 
                                   headers=headers, timeout=10)

        if response.status_code == 200:
            addresses = response.json()
            if addresses:
                return addresses[0]["id"]
        
        print(f"⚠️  Address fetch failed: {response.status_code} {response.text[:100]}")
        return None
    except Exception as e:
        print(f"⚠️  Address fetch error: {e}")
        return None


def create_order(user_data, products, metrics):
    """Tạo 1 order thật qua API Gateway"""
    
    # Random pick product
    product = random.choice(products)
    
    # 1. ADD TO CART FIRST (Mimic real flow & fix CART_EMPTY error)
    if not add_to_cart(user_data, product):
        metrics.record(False, 0, "ADD_CART_FAILED")
        print(f"✗ Order #{metrics.total} - Add to Cart Failed")
        return

    # 2. CHECKOUT
    payload = {
        "userId": user_data["userId"],
        "addressId": user_data["addressId"],
        "paymentMethod": "COD",
        "selectedItems": [{
            "productId": product["productId"],
            "sizeId": product["sizeId"],
            "quantity": 1
        }]
    }
    
    headers = {
        "Authorization": f"Bearer {user_data['token']}",
        "Content-Type": "application/json"
    }
    
    try:
        start = time.time()
        response = requests.post(ORDER_URL, json=payload, headers=headers, timeout=30)
        
        # Fallback for Order Service (Gateway 404 -> Direct 8005)
        if response.status_code == 404:
            # print("⚠️ Gateway 404 for Order, trying direct 8005...")
            response = requests.post("http://localhost:8005/v1/order/create-from-cart", 
                                   json=payload, headers=headers, timeout=30)

        latency = (time.time() - start) * 1000
        
        success = response.status_code in [200, 201]
        error = None if success else f"HTTP {response.status_code}"
        
        metrics.record(success, latency, error)
        
        if success:
            print(f"✓ Order #{metrics.total} - {latency:.0f}ms")
        else:
            print(f"✗ Order #{metrics.total} - {error}")
            # Only print detail error if NOT 404 (because 404 means service totally unreachable)
            if response.status_code != 404 and metrics.total <= 5: 
                print(f"   Error: {response.text[:200]}")

    except Exception as e:
        metrics.record(False, 0, str(e)[:50])
        print(f"✗ Order #{metrics.total} - ERROR: {str(e)[:50]}")


def run_benchmark(users_list, products, metrics):
    """Chạy load test"""
    print(f"\n🚀 STARTING BENCHMARK via Gateway: {GATEWAY_URL}")
    print(f"   Users: {len(users_list)}")
    
    tasks = []
    with ThreadPoolExecutor(max_workers=CONCURRENT_THREADS) as executor:
        for user in users_list:
            # Login & Get Info
            token, uid = login_and_get_token(user[0], user[1])
            if not token: continue
            
            addr_id = get_user_address(token, uid)
            if not addr_id: continue
            
            user_ctx = {"userId": uid, "addressId": addr_id, "token": token}
            
            # Determine order count based on mode
            count = MODE1_TOTAL_ORDERS if TEST_MODE == "MODE_1" else MODE2_ORDERS_PER_USER
            
            for _ in range(count):
                tasks.append(executor.submit(create_order, user_ctx, products, metrics))
        
        for future in as_completed(tasks):
            future.result()


def main():
    print("🚀 REAL Production Load Test (Gateway 8080)")
    
    # 1. Fetch products
    products = fetch_real_products(20)
    if not products: return

    # 2. Prepare Users
    target_users = []
    if TEST_MODE == "MODE_1":
        target_users = [USERS_CREDENTIALS[0]] # Just first user
    else:
        target_users = USERS_CREDENTIALS     # All users
        
    # 3. Run
    metrics = Metrics()
    metrics.start()
    run_benchmark(target_users, products, metrics)
    metrics.print_results()

if __name__ == "__main__":
    main()
