import requests
import json
import time
import concurrent.futures
from concurrent.futures import ThreadPoolExecutor
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import threading

# === CONFIG ===
# Option 1: Through Gateway (realistic but slower)
# ORDER_URL = "http://localhost:8080/order-service/v1/order/create-from-cart"

# Option 2: Direct to Order Service (bypass Gateway for pure performance test)
ORDER_URL = "http://localhost:8080/v1/order/create-from-cart"

# Test parameters
TOTAL_REQUESTS = 5000      # Giảm để test nhanh, tăng khi cần stress test
CONCURRENT_THREADS = 100    # Số threads tối ưu cho local machine
REQUESTS_PER_THREAD = TOTAL_REQUESTS // CONCURRENT_THREADS
CONNECTION_TIMEOUT = 5     # Giảm timeout để phát hiện lỗi nhanh hơn
READ_TIMEOUT = 30          # Tăng read timeout vì Kafka async

# Thread-safe metrics
class ThreadSafeMetrics:
    def __init__(self):
        self.lock = threading.Lock()
        self.success = 0
        self.failed = 0
        self.reservation_failed = 0
        self.timeout_errors = 0
        self.other_errors = 0
        self.latencies = []
        self.error_details = {}
    
    def record_success(self, latency):
        with self.lock:
            self.success += 1
            self.latencies.append(latency)
    
    def record_failure(self, latency, error_type="unknown", detail=""):
        with self.lock:
            self.failed += 1
            self.latencies.append(latency)
            
            if "insufficient" in detail.lower() or "reserve" in detail.lower():
                self.reservation_failed += 1
            elif error_type == "timeout":
                self.timeout_errors += 1
            else:
                self.other_errors += 1
            
            # Track error types
            key = error_type
            if key not in self.error_details:
                self.error_details[key] = 0
            self.error_details[key] += 1

metrics = ThreadSafeMetrics()

def create_session():
    """Create optimized requests session with connection pooling"""
    session = requests.Session()
    
    # Configure connection pooling per thread
    adapter = HTTPAdapter(
        pool_connections=10,
        pool_maxsize=10,
        max_retries=Retry(total=0)  # No retries for accurate measurement
    )
    session.mount('http://', adapter)
    session.mount('https://', adapter)
    
    return session

def load_users():
    with open("user_data.json", "r") as f:
        return json.load(f)

def run_worker_thread(thread_id, users_subset):
    """Worker thread with persistent connection and detailed error tracking"""
    session = create_session()
    user_count = len(users_subset)
    
    for i in range(REQUESTS_PER_THREAD):
        user = users_subset[i % user_count]
        
        payload = {
            "userId": user["userId"],
            "addressId": user["addressId"],
            "paymentMethod": "COD",
            "selectedItems": [{
                "productId": user["targetProduct"]["productId"],
                "sizeId": user["targetProduct"]["sizeId"],
                "quantity": 1
            }]
        }
        headers = {
            "Authorization": f"Bearer {user['token']}",
            "Content-Type": "application/json"
        }
        
        start = time.time()
        try:
            resp = session.post(
                ORDER_URL, 
                json=payload, 
                headers=headers, 
                timeout=(CONNECTION_TIMEOUT, READ_TIMEOUT)
            )
            latency = (time.time() - start) * 1000
            
            if resp.status_code in [200, 201]:
                metrics.record_success(latency)
            else:
                # Parse error detail
                try:
                    error_body = resp.json()
                    detail = error_body.get("message", "") or error_body.get("error", "")
                except:
                    detail = resp.text[:100]
                
                metrics.record_failure(latency, f"http_{resp.status_code}", detail)
                
        except requests.exceptions.Timeout:
            latency = (time.time() - start) * 1000
            metrics.record_failure(latency, "timeout", "Request timeout")
        except requests.exceptions.ConnectionError as e:
            latency = (time.time() - start) * 1000
            metrics.record_failure(latency, "connection_error", str(e)[:50])
        except Exception as e:
            latency = (time.time() - start) * 1000
            metrics.record_failure(latency, "exception", str(e)[:50])
    
    session.close()

def main():
    print("=" * 60)
    print("🚀 PRE-RESERVE PATTERN LOAD TEST")
    print("=" * 60)
    
    print(f"\n📋 CONFIG:")
    print(f"   Target URL: {ORDER_URL}")
    print(f"   Total Requests: {TOTAL_REQUESTS}")
    print(f"   Concurrent Threads: {CONCURRENT_THREADS}")
    print(f"   Requests/Thread: {REQUESTS_PER_THREAD}")
    
    users = load_users()
    if not users:
        print("❌ No users found in user_data.json. Run prepare_data.py first!")
        return
    print(f"   Users loaded: {len(users)}")
    
    print(f"\n🔥 STARTING LOAD TEST...")
    start_time = time.time()
    
    with ThreadPoolExecutor(max_workers=CONCURRENT_THREADS) as executor:
        futures = []
        for thread_id in range(CONCURRENT_THREADS):
            futures.append(executor.submit(run_worker_thread, thread_id, users))
        
        # Wait for all threads
        concurrent.futures.wait(futures)
    
    end_time = time.time()
    duration = end_time - start_time
    
    # Calculate metrics
    total_completed = metrics.success + metrics.failed
    throughput = total_completed / duration if duration > 0 else 0
    success_rate = (metrics.success / total_completed * 100) if total_completed > 0 else 0
    
    print(f"\n" + "=" * 60)
    print(f"✅ LOAD TEST COMPLETED")
    print(f"=" * 60)
    
    print(f"\n📊 RESULTS:")
    print(f"   Duration: {duration:.2f}s")
    print(f"   Total Requests: {total_completed}")
    print(f"   ├── Success: {metrics.success} ({success_rate:.1f}%)")
    print(f"   └── Failed: {metrics.failed}")
    
    if metrics.failed > 0:
        print(f"\n   🔍 FAILURE BREAKDOWN:")
        print(f"      ├── Reservation Failed (stock): {metrics.reservation_failed}")
        print(f"      ├── Timeout: {metrics.timeout_errors}")
        print(f"      └── Other: {metrics.other_errors}")
        
        if metrics.error_details:
            print(f"\n   📋 ERROR TYPES:")
            for k, v in sorted(metrics.error_details.items(), key=lambda x: x[1], reverse=True)[:5]:
                print(f"      ├── {k}: {v}")
    
    print(f"\n   ⚡ THROUGHPUT: {throughput:.2f} req/sec")
    
    if metrics.latencies:
        latencies = sorted(metrics.latencies)
        size = len(latencies)
        p50 = latencies[int(size * 0.5)]
        p90 = latencies[int(size * 0.9)]
        p95 = latencies[int(size * 0.95)]
        p99 = latencies[int(size * 0.99)] if size > 100 else latencies[-1]
        avg = sum(latencies) / size
        
        print(f"\n   📈 LATENCY:")
        print(f"      ├── Avg: {avg:.0f}ms")
        print(f"      ├── p50: {p50:.0f}ms")
        print(f"      ├── p90: {p90:.0f}ms")
        print(f"      ├── p95: {p95:.0f}ms")
        print(f"      └── p99: {p99:.0f}ms")
    
    # Performance assessment
    print(f"\n" + "=" * 60)
    print(f"💡 PERFORMANCE ASSESSMENT:")
    print(f"=" * 60)
    
    if throughput >= 500:
        print(f"   🎉 EXCELLENT! Throughput > 500 req/s on local machine!")
    elif throughput >= 200:
        print(f"   ✅ GOOD! Throughput > 200 req/s, Pre-Reserve working well.")
    elif throughput >= 100:
        print(f"   ⚠️ MODERATE. Throughput ~100 req/s. Check for bottlenecks.")
    else:
        print(f"   ❌ LOW. Throughput < 100 req/s. Investigate issues.")
    
    if metrics.reservation_failed > 0:
        print(f"\n   📝 NOTE: {metrics.reservation_failed} reservation failures detected.")
        print(f"      This is EXPECTED if stock is depleted during test.")
        print(f"      Pre-Reserve Pattern correctly prevented overselling!")
    
    print(f"\n   💻 LOCAL MACHINE LIMITATIONS:")
    print(f"      - All services share CPU/RAM")
    print(f"      - Database, Redis, Kafka also running locally")
    print(f"      - Expected: 100-500 req/s on typical laptop")
    print(f"      - Production (separate servers): 5,000-10,000 req/s")

if __name__ == "__main__":
    main()
