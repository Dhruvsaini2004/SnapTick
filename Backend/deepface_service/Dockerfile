# DeepFace Service Dockerfile
# NOTE: This service requires a paid tier on Render (min 1GB RAM)
# For development/demo, run locally or use Render's Starter plan ($7/month)

FROM python:3.10-slim

# Install system dependencies for OpenCV and canvas
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app.py .

# Expose port
EXPOSE 5001

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV TF_CPP_MIN_LOG_LEVEL=2

# Run the application
CMD ["python", "app.py"]
