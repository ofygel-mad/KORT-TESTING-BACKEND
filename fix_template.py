with open('src/pages/warehouse/index.tsx', 'rb') as f:
    raw = f.read()

# Fix the broken template literal - replace the malformed line
# The line should be: {(order.items ?? []).length > 2 ? ` +${(order.items ?? []).length - 2}` : ''}
content = raw.decode('utf-8')

# Find and fix the broken line
bad_variants = [
    "{(order.items ?? []).length > 2 ? \\ : ''}",
    "{(order.items ?? []).length > 2 ?  : ''}",
    '{(order.items ?? []).length > 2 ? \\ : \'\'}',
]

good = "{(order.items ?? []).length > 2 ? ` +${(order.items ?? []).length - 2}` : ''}"

fixed = False
for bad in bad_variants:
    if bad in content:
        content = content.replace(bad, good)
        print(f'Fixed: {repr(bad)}')
        fixed = True
        break

if not fixed:
    # Show what's actually on that line
    lines = content.split('\n')
    for i, line in enumerate(lines[908:914], start=909):
        print(f'Line {i}: {repr(line)}')

with open('src/pages/warehouse/index.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

print('Done. good in content:', good in content)
