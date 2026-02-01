graph TB
    %% User Layer
    A[React/HTML Frontend<br/>Menu + Recommendations<br/>QR Bill Generation] 
    B[College Student<br/>1-hour Lunch Break]
    
    %% API Gateway
    C[API Gateway<br/>JWT Auth + Rate Limiting]
    
    %% Backend Services
    D[Node.js/Express Backend<br/>Order Processing<br/>Razorpay Payments]
    E[Socket.io<br/>Real-time Status]
    
    %% ML Service
    F[Python ML Microservice<br/>Flask/FastAPI<br/>LSTM + Collaborative Filtering]
    
    %% Data Layer
    G[MongoDB<br/>Users + Orders + Menu]
    H[Redis<br/>Session + Cache]
    
    %% Restaurant Layer
    I[Restaurant Counter<br/>QR Scanner App<br/>Instant Fulfillment]
    
    %% Flows
    B -->|Pre-Order| A
    A -->|API Calls| C
    C --> D
    D -->|Auth| G
    D -->|Cache| H
    D -->|Predictions| F
    D -->|Payments| D
    F -->|Demand Forecast<br/>Recommendations| D
    D -->|WebSocket| E
    E -->|Status Updates| A
    D -->|QR Bill| A
    A -->|Show QR| B
    B -->|Scan at Counter| I
    I -->|Validate| D
    D -->|Fulfill| I
    
    %% Styling
    classDef frontend fill:#e1f5fe
    classDef backend fill:#f3e5f5
    classDef ml fill:#e8f5e8
    classDef data fill:#fff3e0
    classDef restaurant fill:#ffebee
    
    class A,B frontend
    class C,D,E backend
    class F ml
    class G,H data
    class I restaurant
