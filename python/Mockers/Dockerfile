# Use the official Python 3.11 Alpine image as the base.
# Alpine is a lightweight Linux distribution, which results in a smaller Docker image.
FROM python:3.11-alpine

# Set the working directory inside the container.
# This is where your scripts will be placed.
WORKDIR /app

# Upgrade pip to the latest version to ensure all packages can be installed.
RUN pip install --no-cache-dir --upgrade pip

# Copy the requirements file into the container.
# This step is crucial for separating the layer for dependencies, improving build performance.
# We use a standard requirements.txt file to list all Python dependencies.
COPY requirements.txt .

# Install all the packages listed in requirements.txt.
# We use --no-cache-dir to keep the image size small.
RUN pip install --no-cache-dir -r requirements.txt

# Copy your local application code (e.g., your Python scripts) into the container.
COPY . .

# Command to run your script when the container starts.
# You can change 'mocker.py' to the name of your script.
CMD ["python3", "mocker.py"]
