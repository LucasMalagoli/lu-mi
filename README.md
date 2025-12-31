# Proj Lu Mi

A full-stack web application built with React and FastAPI, containerized with Docker.

## Technologies

- **Frontend:** React 19, Vite, TailwindCSS, Nginx
- **Backend:** Python 3.11, FastAPI, Uvicorn, Redis
- **Infrastructure:** Docker, Docker Compose

## Setup

### Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose installed.

### Running with Docker

1. **Clone the repository**
    ```bash
    git clone <repository-url>
    cd proj-lu-mi
    ```

2. **Configure Environment Variables**
   The backend service requires an environment file as referenced in `docker-compose.yml`.
    ```bash
    # Create .env file for backend
    touch backend/.env
    # Add necessary environment variables to backend/.env
    ```

3. **Start the Application**
    ```bash
    docker-compose up --build
    ```

4. **Access the Services Locally**
   - **Frontend:** http://localhost:3000
   - **Backend API:** http://localhost:8000
   - **API Documentation:** http://localhost:8000/docs
