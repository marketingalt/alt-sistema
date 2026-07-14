import json
d = json.load(open('/Users/thiemyrocha/alt-orcamentos/data/fluxo-caixa.json'))
c6 = [e for e in d['lancamentos'] if e['banco'] == 'C6 BANK']
s = sum(e['valor'] for e in c6)
print('C6 entries:', len(c6))
print('C6 sum:', s)
print('+ saldoInicial:', s + d['saldoInicial'])
print('Expected:', 6026.06)
print('Diff:', round(s + d['saldoInicial'] - 6026.06, 2))
