import json
import sys
import os
from collections import OrderedDict

# Get file path from argument or default
file_path = sys.argv[1] if len(sys.argv) > 1 else 'src/i18n/locales/en.json'

print(f"Processing {file_path}...")

try:
    def duplicates_hook(ordered_pairs):
        return ordered_pairs

    with open(file_path, 'r', encoding='utf-8') as f:
        root_items = json.load(f, object_pairs_hook=duplicates_hook)

    shop_owner_key = 'shopOwner'
    shop_owner_idx = -1
    for i, (k, v) in enumerate(root_items):
        if k == shop_owner_key:
            shop_owner_idx = i
            break
            
    if shop_owner_idx == -1:
        print(f"Error: {shop_owner_key} key not found in {file_path}")
        sys.exit(1)

    shop_owner_list = root_items[shop_owner_idx][1]

    # Keys that should be inside shopOwner
    keys_to_move = ['decoration', 'reviews', 'vouchers', 'analytics', 'manageOrder', 'addProduct', 'allProducts', 'attributes', 'settings', 'subscription', 'returnOrder']
    # Keys that might exist at root but need checking if they belong to Shop or Client
    keys_to_check = ['product', 'notifications', 'chat', 'wallet', 'dashboard']

    items_to_move = []
    indices_to_remove = []

    for i, (k, v) in enumerate(root_items):
        move = False
        delete = False
        
        if k in keys_to_move:
            move = True
        elif k in keys_to_check:
            subkeys = []
            if isinstance(v, list):
                # v is list of (key, val) tuples
                subkeys = [x[0] for x in v]
                
            if k == 'dashboard':
                # If dashboard is at root, it's likely the duplicate Shop Dashboard. 
                # Client doesn't have a dashboard key at root in this app's context.
                if i != shop_owner_idx: 
                    delete = True
            elif k == 'chat':
                # Shop chat has 'conversations'
                if 'conversations' in subkeys: move = True
            elif k == 'wallet':
                # Shop wallet has 'overview' or 'promo'
                if 'overview' in subkeys or 'promo' in subkeys: move = True
            elif k == 'notifications':
                # Shop notifications has 'newOrder'
                if 'newOrder' in subkeys: move = True
            elif k == 'product':
                # Shop product has 'form'
                if 'form' in subkeys: move = True
        
        if move:
            items_to_move.append((k, v))
            indices_to_remove.append(i)
        elif delete:
            print(f"Deleting duplicate root key: {k}")
            indices_to_remove.append(i)

    # Process returnOrder nesting into manageOrder
    # Locate manageOrder in items_to_move
    manage_order_item = next((x for x in items_to_move if x[0] == 'manageOrder'), None)
    return_order_item = next((x for x in items_to_move if x[0] == 'returnOrder'), None)
    
    if manage_order_item and return_order_item:
        print("Merging returnOrder into manageOrder...")
        manage_order_item[1].append(return_order_item)
        items_to_move.remove(return_order_item)

    # Append to shopOwner
    if items_to_move:
        print(f"Moving {len(items_to_move)} keys to shopOwner: {[x[0] for x in items_to_move]}")
        shop_owner_list.extend(items_to_move)

    # Remove from root (reverse order)
    for i in sorted(indices_to_remove, reverse=True):
        del root_items[i]

    # Convert to dict for dumping
    def to_dict(item_list):
        d = OrderedDict()
        for k, v in item_list:
            if isinstance(v, list) and len(v) > 0 and isinstance(v[0], tuple):
                d[k] = to_dict(v)
            else:
                d[k] = v
        return d

    final_dict = to_dict(root_items)

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(final_dict, f, indent=2, ensure_ascii=False)
        
    print("Done.")

except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
