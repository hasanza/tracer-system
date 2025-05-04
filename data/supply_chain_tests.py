import pytest
from supply_chain import PUFSimulator, RaspberryPiSimulator

def test_puf_response():
    puf = PUFSimulator("12345")
    challenge = "test_challenge"
    response = puf.generate_response(challenge)
    assert len(response) == 64  # SHA-256 hash length

def test_location_generation():
    location = RaspberryPiSimulator.get_location()
    assert isinstance(location, str) and len(location) > 0