# SmartSales

A full-stack AI-powered sales intelligence platform that combines a JavaScript backend and frontend with a Python machine learning layer to deliver smart sales insights and predictions.

## Tech Stack

| Layer    | Technology        |
|----------|-------------------|
| Frontend | JavaScript        |
| Backend  | Node.js           |
| ML       | Python            |

## Project Structure

```
SmartSales/
├── frontend/      # Client-side UI
├── backend/       # REST API / server logic
├── ml/            # Machine learning models & scripts
└── index.js       # App entry point
```

## Getting Started

### Prerequisites

- Node.js (v18+)
- Python (3.9+)
- npm or yarn

### Installation

```bash
# Clone the repo
git clone https://github.com/Yasir-Zafar/SmartSales.git
cd SmartSales

# Install JS dependencies
npm install

# Install Python dependencies
cd ml
pip install -r requirements.txt
```

### Running the App

```bash
# Start the backend
node index.js

# In a separate terminal, start the frontend
cd frontend
npm start
```

## Contributing

Pull requests are welcome. For major changes, open an issue first to discuss what you'd like to change.

## License

[MIT](https://choosealicense.com/licenses/mit/)
