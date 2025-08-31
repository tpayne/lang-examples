# Sample Mock Travel Data Generator

This repository provides a Python script and Docker setup for generating mock travel data, including flights, hotels, and travel packages. The data is created using the `Faker` library for realistic, randomized results.

## 1. Project Setup

To get started, ensure **Docker** is installed on your machine. All other dependencies, including Python and required libraries, are managed within the Docker container.

### Required Files

Place the following files in the same directory:

- `Dockerfile`
- `mocker.py` (Python script)
- `requirements.txt`

Your `requirements.txt` should include:

```
Faker==25.0.0
```

## 2. Running the Script with Docker

Docker provides a consistent environment and avoids dependency conflicts.

### Step 1: Build the Docker Image

Open your terminal and build the Docker image:

```sh
docker build -t python-tester .
```

### Step 2: Run the Container

Run a container from the image, mounting your local directory to access generated files:

```sh
docker run -v $(pwd):/app python-tester
```

**Explanation:**

- `docker run`: Starts a new container.
- `-v $(pwd):/app`: Mounts your current directory to `/app` in the container, so files like `flights.json`, `hotels.json`, and `packages.json` appear locally.

## 3. Understanding the Mock Schemas

The script generates three JSON files, each a top-level array of entities:

- `flights.json`: Flight records with fields such as `airline`, `flightNumber`, `originAirport`, `destinationAirport`, `departureDate`, `departureTime`, `class`, `price`, and `seatAvailability`.
- `hotels.json`: Hotel records with fields like `name`, `location`, `checkInDate`, `checkOutDate`, `roomType`, `pricePerNight`, `totalRoomsAvailable`, and `amenities`.
- `packages.json`: Travel packages combining flight and hotel details, including `name`, `destination`, `startDate`, `endDate`, `price`, `inclusions`, plus nested `flightDetails` and `hotelDetails`.

## 4. Modifying the Script

The `mocker.py` script is easily customizable.

### Adjusting the Number of Records

To change the number of records, edit the `NUM_RECORDS` variable at the top of the `if __name__ == "__main__":` block in `mocker.py`:

```python
NUM_RECORDS = 400
```

### Modifying the Schema

To add or remove fields, update the relevant function (`generate_flight_data`, `generate_hotel_data`, or `generate_package_data`) in `mocker.py`. For example, to add an `is_direct_flight` flag to flights:

```python
def generate_flight_data():
    # ... other code ...
    return {
        "airline": faker.company(),
        "flightNumber": f"{faker.word(ext_word_list=['UA', 'AA', 'DL', 'WN'])}{faker.random_int(min=100, max=999)}",
        # ... other fields ...
        "is_direct_flight": random.choice([True, False])  # New field
    }
```

After making changes, rebuild and rerun the Docker container to generate updated data.
