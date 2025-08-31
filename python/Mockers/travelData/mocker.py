import json
import random
import sys
import argparse
from datetime import datetime, timedelta
from faker import Faker

# Initialize the Faker generator
Faker.seed(0)  # Use a seed for repeatable results
faker = Faker()

# --- Realistic Data Sources for Mocker ---
# Using static lists for a bit more realism and control
AIRPORTS = ["JFK", "LAX", "ORD", "SFO", "MIA", "LHR", "CDG", "NRT", "SYD", "DXB", "IST", "BOS", "MCO", "DEN"]
AIRPORT_NAMES = {
    "JFK": "John F. Kennedy International Airport",
    "LAX": "Los Angeles International Airport",
    "ORD": "O'Hare International Airport",
    "SFO": "San Francisco International Airport",
    "MIA": "Miami International Airport",
    "LHR": "Heathrow Airport",
    "CDG": "Charles de Gaulle Airport",
    "NRT": "Narita International Airport",
    "SYD": "Sydney Airport",
    "DXB": "Dubai International Airport",
    "IST": "Istanbul Airport",
    "BOS": "Logan International Airport",
    "MCO": "Orlando International Airport",
    "DEN": "Denver International Airport"
}
CITIES = ["New York, NY", "Las Vegas, NV", "London, UK", "Paris, France", "Tokyo, Japan", "Cancun, Mexico", "Sydney, Australia"]
ROOM_TYPES = ["Standard Room", "Deluxe Room", "King Room", "Luxury Suite", "Overwater Villa"]
AMENITIES = ["Free Wi-Fi", "Swimming Pool", "Gym", "Restaurant", "Spa", "Private Beach", "Rooftop Pool", "Casino"]
PACKAGE_NAMES = ["Weekend Getaway", "European City Break", "Hawaiian Paradise", "Ski Adventure", "Safari in the Serengeti"]

def generate_flight_data():
    """Generates a single flight record using Faker and realistic data."""
    origin = random.choice(AIRPORTS)
    destination = random.choice([a for a in AIRPORTS if a != origin])
    
    # Use explicit datetime objects to prevent empty date range error
    start_date_range = datetime.now() + timedelta(days=1)
    end_date_range = datetime.now() + timedelta(days=90)
    departure_date = faker.date_between_dates(date_start=start_date_range, date_end=end_date_range)

    arrival_date = departure_date
    if faker.random_int(min=1, max=10) < 3: # ~20% of flights are long-haul and arrive next day
        arrival_date += timedelta(days=1)

    return {
        "airline": faker.company(),
        "flightNumber": f"{faker.word(ext_word_list=['UA', 'AA', 'DL', 'WN'])}{faker.random_int(min=100, max=999)}",
        "originAirport": origin,
        "destinationAirport": destination,
        "departureDate": departure_date.strftime("%Y-%m-%d"),
        "departureTime": faker.time(),
        "arrivalDate": arrival_date.strftime("%Y-%m-%d"),
        "arrivalTime": arrival_date.strftime("%H:%M:%S"),
        "class": random.choice(["Economy", "Business", "First"]),
        "price": round(faker.random_int(min=150, max=5000), 2),
        "seatAvailability": faker.random_int(min=10, max=150)
    }

def generate_hotel_data():
    """Generates a single hotel record using Faker and realistic data."""
    # Use explicit datetime objects to prevent empty date range error
    check_in_date = faker.date_between_dates(date_start=datetime.now() + timedelta(days=1), date_end=datetime.now() + timedelta(days=90))
    check_out_date = faker.date_between_dates(date_start=check_in_date + timedelta(days=1), date_end=check_in_date + timedelta(days=15))
    
    return {
        "name": faker.company() + " Hotel",
        "location": random.choice(CITIES),
        "checkInDate": check_in_date.strftime("%Y-%m-%d"),
        "checkOutDate": check_out_date.strftime("%Y-%m-%d"),
        "roomType": random.choice(ROOM_TYPES),
        "pricePerNight": round(faker.random_int(min=100, max=1500), 2),
        "totalRoomsAvailable": faker.random_int(min=1, max=100),
        "amenities": random.sample(AMENITIES, k=random.randint(2, len(AMENITIES)))
    }

def generate_package_data():
    """Generates a single travel package record using Faker and other functions."""
    
    # Generate flight and hotel details that are plausible for a package
    flight = generate_flight_data()
    hotel = generate_hotel_data()
    
    return {
        "name": random.choice(PACKAGE_NAMES),
        "destination": hotel["location"],
        "startDate": flight["departureDate"],
        "endDate": hotel["checkOutDate"],
        "price": round(faker.random_int(min=1500, max=10000), 2),
        "flightDetails": {
            "airline": flight["airline"],
            "flightNumber": flight["flightNumber"],
            "originAirport": flight["originAirport"],
            "destinationAirport": flight["destinationAirport"],
            "departureDate": flight["departureDate"],
            "departureTime": flight["departureTime"]
        },
        "hotelDetails": {
            "name": hotel["name"],
            "checkInDate": hotel["checkInDate"],
            "checkOutDate": hotel["checkOutDate"],
            "roomType": hotel["roomType"]
        },
        "inclusions": random.sample(["Round-trip flights", "Hotel stay", "Guided city tours", "All-inclusive meals", "Excursions"], k=random.randint(2, 5))
    }

def generate_all_data(num_records):
    """
    Generates a specified number of records, categorized by type.
    """
    flights = []
    hotels = []
    packages = []
    
    # Generate records and distribute them randomly
    for i in range(num_records):
        record_type = random.choice(["flight", "hotel", "package"])
        
        record = {
            "type": record_type,
            "recordId": f"{record_type.upper()}-{i+1:03d}",
            "availabilityStatus": "Available"
        }
        
        if record_type == "flight":
            record["details"] = generate_flight_data()
            flights.append(record)
        elif record_type == "hotel":
            record["details"] = generate_hotel_data()
            hotels.append(record)
        elif record_type == "package":
            record["details"] = generate_package_data()
            packages.append(record)
            
    return flights, hotels, packages

def save_to_json(data, filename):
    """
    Saves a list of dictionaries to a JSON file.
    """
    with open(filename, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"Successfully generated and saved {len(data)} records to '{filename}'.")

def save_to_jsonl(data, filename):
    """
    Saves a list of dictionaries to a JSONL file, with each item on a new line.
    """
    with open(filename, 'w') as f:
        for item in data:
            f.write(json.dumps(item) + '\n')
    print(f"Successfully generated and saved {len(data)} records to '{filename}'.")

def save_airports_to_json(data, filename):
    """
    Saves the airport codes and names to a JSON file.
    """
    with open(filename, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"Successfully generated and saved {len(data)} airport records to '{filename}'.")

def save_airports_to_jsonl(data, filename):
    """
    Saves the airport codes and names to a JSONL file, with each item on a new line.
    """
    with open(filename, 'w') as f:
        for code, name in data.items():
            record = {"airportCode": code, "airportName": name}
            f.write(json.dumps(record) + '\n')
    print(f"Successfully generated and saved {len(data)} airport records to '{filename}'.")


if __name__ == "__main__":
    # Set up command-line argument parser
    parser = argparse.ArgumentParser(description="Generate mock travel data in JSON and/or JSONL format.")
    parser.add_argument(
        "--format",
        "-f",
        choices=["json", "jsonl", "both"],
        default="both",
        help="Specify the output format for the data files. (default: both)"
    )
    args = parser.parse_args()

    NUM_RECORDS = 400
    
    print(f"Generating {NUM_RECORDS} records of travel data...")
    flights, hotels, packages = generate_all_data(NUM_RECORDS)
    
    # Save data based on the specified format
    if args.format in ["json", "both"]:
        save_to_json(flights, "flights.json")
        save_to_json(hotels, "hotels.json")
        save_to_json(packages, "packages.json")
        save_airports_to_json(AIRPORT_NAMES, "airports.json")
    
    if args.format in ["jsonl", "both"]:
        save_to_jsonl(flights, "flights.jsonl")
        save_to_jsonl(hotels, "hotels.jsonl")
        save_to_jsonl(packages, "packages.jsonl")
        save_airports_to_jsonl(AIRPORT_NAMES, "airports.jsonl")
    
    print("Generation complete!")
