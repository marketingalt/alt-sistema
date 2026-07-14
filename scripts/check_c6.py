import json, re, sys
from collections import defaultdict

with open('/Users/thiemyrocha/alt-orcamentos/data/fluxo-caixa.json') as f:
    data = json.load(f)

lancamentos = data['lancamentos']
saldo_inicial = data['saldoInicial']

c6 = [e for e in lancamentos if e['banco'] == 'C6 BANK']
c6_sum = sum(e['valor'] for e in c6)
total_c6 = c6_sum + saldo_inicial

print("=" * 70)
print("C6 BANK ANALYSIS")
print("=" * 70)
print(f"saldoInicial:                    R$ {saldo_inicial:>10.2f}")
print(f"Sum of all C6 BANK valores:      R$ {c6_sum:>10.2f}")
print(f"Total C6 (saldoInicial + sum):   R$ {total_c6:>10.2f}")
print(f"Expected C6 balance:             R$ {6026.06:>10.2f}")
print(f"DIFFERENCE:                      R$ {total_c6 - 6026.06:>10.2f}")
print()

# Monthly breakdown
monthly = defaultdict(float)
monthly_count = defaultdict(int)
for e in c6:
    month = e['data'][:7]
    monthly[month] += e['valor']
    monthly_count[month] += 1

print("Monthly C6 breakdown:")
running = saldo_inicial
for m in sorted(monthly.keys()):
    running += monthly[m]
    print(f"  {m}: count={monthly_count[m]:3d}  sum=R$ {monthly[m]:>12.2f}  running=R$ {running:>10.2f}")
print()

# Check specific months
for m in ['2026-03', '2026-04', '2026-05', '2026-06']:
    month_entries = sorted([e for e in c6 if e['data'].startswith(m)], key=lambda x: x['data'])
    month_sum = sum(e['valor'] for e in month_entries)
    print(f"\n{m} C6 entries ({len(month_entries)} total, sum=R$ {month_sum:.2f}):")
    if month_entries:
        for e in month_entries:
            print(f"  {e['data']}  {e['valor']:>10.2f}  {e['modalidade']:>8s}  {e['categoria'][:40]}")

# Suspicious: negative valor but revenue category
print("\n\nSUSPICIOUS: Negative valor with positive revenue categories:")
for e in lancamentos:
    if e['valor'] < 0 and 'RECEITA' in e['categoria']:
        print(f"  {e['data']}  banco={e['banco']:15s}  valor={e['valor']:>10.2f}  cat={e['categoria']}  obs={e['obs'][:60]}")

# Check 2026-06-05 entries
print("\n\n2026-06-05 ALL entries:")
for e in sorted([e for e in lancamentos if e['data'] == '2026-06-05'], key=lambda x: x['banco']):
    print(f"  banco={e['banco']:15s}  valor={e['valor']:>10.2f}  modalidade={e['modalidade']:>8s}  cat={e['categoria'][:40]}  obs={e['obs'][:70]}")

# Check OTHER banks' entries that might affect C6 balance
print("\n\nOther banks transactions on C6 dates (2026-06):")
for e in sorted([e for e in lancamentos if e['data'].startswith('2026-06') and e['banco'] != 'C6 BANK' and e['banco'] != ''], key=lambda x: x['data']):
    print(f"  {e['data']}  banco={e['banco']:15s}  valor={e['valor']:>10.2f}  cat={e['categoria'][:40]}")

# Summary of all banks
print("\n\nALL BANKS:")
bank_totals = defaultdict(float)
bank_counts = defaultdict(int)
for e in lancamentos:
    bank_totals[e['banco']] += e['valor']
    bank_counts[e['banco']] += 1
for b in sorted(bank_totals.keys()):
    total_b = bank_totals[b] + (saldo_inicial if b == 'C6 BANK' else 0)
    print(f"  {b:25s}  n={bank_counts[b]:4d}  sum=R$ {bank_totals[b]:>12.2f}")
