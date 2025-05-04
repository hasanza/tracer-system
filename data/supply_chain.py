import json
import time
from web3 import Web3
from faker import Faker
import hashlib

# Initialize Faker for fake location data
fake = Faker()

# Connect to Hardhat local blockchain
w3 = Web3(Web3.HTTPProvider('http://localhost:8545'))
w3.eth.default_account = w3.eth.accounts[0]

supplyChainABI = './scripts/deployedContract.json'

# Load contract ABI and address (deployed via Hardhat)
with open(supplyChainABI, 'r') as f:
    contract_data = json.load(f)
contract = w3.eth.contract(
    address=contract_data['address'],
    abi=contract_data['abi']
)

class PUFSimulator:
    def __init__(self, puf_id):
        self.puf_id = puf_id
    
    def generate_response(self, challenge):
        # Simulate PUF response using SHA-256 hash
        combined = f"{challenge}-{self.puf_id}".encode()
        return hashlib.sha256(combined).hexdigest()

class RaspberryPiSimulator:
    @staticmethod
    def get_location():
        return fake.city()

# Manufacturer registers new product (puf id is the product id)
def manufacturer_register_product(puf_id, expected_hash):
    tx_hash = contract.functions.addValidPufId(
        puf_id,
        expected_hash
    ).transact()
    return tx_hash

#Distributer and then the retailer updates the location
def update_product_location(puf_id, challenge, role):
    puf = PUFSimulator(puf_id)
    response = puf.generate_response(challenge)
    location = RaspberryPiSimulator.get_location()
    timestamp = int(time.time())
    
    tx_hash = contract.functions.addRecord(
        puf_id,
        challenge,
        response,
        location,
        timestamp
    ).transact({'from': w3.eth.accounts[1 if role == 'distributor' else 2]})
    return tx_hash

# Updated supply_chain.py
def simulate_manufacturer(puf_id, challenge):
    response = hashlib.sha256(f"{challenge}-{puf_id}".encode()).hexdigest()
    tx_hash = contract.functions.addValidPufId(puf_id, response).transact()
    return tx_hash

def simulate_distributor(puf_id, challenge, location):
    puf = PUFSimulator(puf_id)
    response = puf.generate_response(challenge)
    tx_hash = contract.functions.addRecord(
        puf_id,
        challenge,
        response,
        location
    ).transact({'from': distributor_address})
    return tx_hash

def transfer_ownership(puf_id, new_owner):
    tx_hash = contract.functions.transferOwnership(puf_id, new_owner).transact()
    return tx_hash

if __name__ == "__main__":
    # Example usage
    puf_id = "12345"
    challenge = "challenge_001"
    
    # Manufacturer registers PUF
    expected_hash = hashlib.sha256(f"{challenge}-{puf_id}".encode()).hexdigest()
    manufacturer_register_product(puf_id, expected_hash)
    
    # Distributor updates location
    update_product_location(puf_id, challenge, "distributor")