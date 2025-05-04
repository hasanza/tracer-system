from flask import Flask, json, jsonify
from web3 import Web3

app = Flask(__name__)
w3 = Web3(Web3.HTTPProvider('http://localhost:8545'))

supplyChainABI = '../../scripts/deployedContract.json'

with open(supplyChainABI, 'r') as f:
    contract_data = json.load(f)
contract = w3.eth.contract(
    address=contract_data['address'],
    abi=contract_data['abi']
)

# Fetches the record having the provided puf_id by querying the smart contract
@app.route('/records/<puf_id>')
def get_records(puf_id):
    records = []
    record_count = contract.functions.recordCount().call()
    for i in range(record_count):
        record = contract.functions.records(i).call()
        if record[0] == puf_id:
            records.append({
                "location": record[3],
                "timestamp": record[4],
            })
    return jsonify(records)

if __name__ == '__main__':
    app.run(debug=True)