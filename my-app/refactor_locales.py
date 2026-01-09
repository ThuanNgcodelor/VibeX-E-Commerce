import json
import sys
import os
from collections import OrderedDict

files = ['src/i18n/locales/en.json', 'src/i18n/locales/vi.json']

print("Starting refactor process...")

for file_path in files:
    print(f"\nProcessing {file_path}...")
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        continue
        
    try:
        # Use utf-8-sig to handle BOM if present, otherwise utf-8
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            root_items = json.load(f, object_pairs_hook=lambda x: x)

        shop_owner_key = 'shopOwner'
        shop_owner_idx = -1
        for i, (k, v) in enumerate(root_items):
            if k == shop_owner_key:
                shop_owner_idx = i
                break
                
        if shop_owner_idx == -1:
            print(f"Skipping {file_path}: shopOwner key not found.")
            continue

        shop_owner_list = root_items[shop_owner_idx][1]

        keys_to_move = ['decoration', 'reviews', 'vouchers', 'analytics', 'manageOrder', 'addProduct', 'allProducts', 'attributes', 'settings', 'subscription', 'returnOrder']
        keys_to_check = ['product', 'notifications', 'chat', 'wallet', 'dashboard']

        items_to_move = []
        indices_to_remove = []

        print(f"Scanning {len(root_items)} root items...")

        for i, (k, v) in enumerate(root_items):
            move = False
            delete = False
            
            if k in keys_to_move:
                move = True
                print(f"  Found {k} to move.")
            elif k in keys_to_check:
                subkeys = []
                if isinstance(v, list):
                    subkeys = [x[0] for x in v]
                    
                if k == 'dashboard':
                    if i != shop_owner_idx:
                        delete = True
                        print(f"  Found duplicate dashboard at root to delete.")
                elif k == 'chat':
                    if 'conversations' in subkeys: 
                        move = True
                        print(f"  Found Shop chat to move.")
                elif k == 'wallet':
                    if 'overview' in subkeys or 'promo' in subkeys: 
                        move = True
                        print(f"  Found Shop wallet to move.")
                elif k == 'notifications':
                    if 'newOrder' in subkeys: 
                        move = True
                        print(f"  Found Shop notifications to move.")
                elif k == 'product':
                    if 'form' in subkeys: 
                        move = True
                        print(f"  Found Shop product form to move.")
            
            if move:
                items_to_move.append((k, v))
                indices_to_remove.append(i)
            elif delete:
                indices_to_remove.append(i)

        if not items_to_move and not indices_to_remove:
            print("  No changes needed.")
            continue

        # Append to shopOwner
        shop_owner_list.extend(items_to_move)

        # Remove from root
        for i in sorted(indices_to_remove, reverse=True):
            del root_items[i]

        # Save
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
            
        print(f"  Successfully moved {len(items_to_move)} keys and deleted {len(indices_to_remove) - len(items_to_move)} keys.")

    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        import traceback
        traceback.print_exc()

print("\nRefactor process completed.")
