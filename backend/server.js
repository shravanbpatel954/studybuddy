try {
    // Load environment variables from .env file
    // Try multiple possible locations
    const path = require('path');
    const fs = require('fs');
    
    const possibleEnvPaths = [
      path.resolve(__dirname, '.env'),
      path.resolve(__dirname, 'env', '.env'),
      path.resolve(__dirname, 'env', 'config.env'),
      path.resolve(__dirname, '..', '.env'),
    ];
    
    let envLoaded = false;
    for (const envPath of possibleEnvPaths) {
      if (fs.existsSync(envPath)) {
        require("dotenv").config({ path: envPath });
        console.log(`Loaded .env file from: ${envPath}`);
        envLoaded = true;
        break;
      }
    }
    
    if (!envLoaded) {
      // Try default location
      require("dotenv").config();
      console.log('Attempted to load .env from default location');
    }
    
    require("colors")
    console.log("Loading modules...")
    
    // Debug: Log QPP-related env vars (without showing full key)
    const qppKeys = Object.keys(process.env).filter(k => k.toUpperCase().includes('QPP'));
    if (qppKeys.length > 0) {
        console.log('Found QPP-related environment variables:', qppKeys.map(k => `${k}=${process.env[k] ? '***' + process.env[k].slice(-4) : 'undefined'}`));
    } else {
        console.warn('No QPP-related environment variables found');
        console.warn('Make sure your .env file contains QPP_data=YOUR_API_KEY');
    }
    
    // Initialize PDF.js
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf');
    pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker');
    console.log("PDF.js initialized successfully")
    
    let app;
    try {
        app = require("./src/app");
        console.log("App loaded successfully")
    } catch (err) {
        console.error("Error loading app:", err.message);
        console.error("Stack trace:", err.stack);
        // Try to identify which module is causing the issue
        if (err.stack) {
            const stackLines = err.stack.split('\n');
            for (const line of stackLines) {
                if (line.includes('.js') && !line.includes('node:internal')) {
                    console.error("Potential problematic file:", line.trim());
                }
            }
        }
        throw err;
    }
    
    const { ConnectDB } = require("./src/config/db.config");
    console.log("DB config loaded successfully")
    
    const port = process.env.PORT || 8080

    console.log("Starting server...")
    console.log("Port:", port)

    ConnectDB()

    // Create HTTP server and attach Socket.IO
    const http = require('http');
    const server = http.createServer(app);
    const { Server } = require('socket.io');
    const io = new Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });

    // Initialize socket handlers
    try {
        const socketHandler = require('./src/utils/socketHandler');
        const { setIo } = require('./src/utils/socketStore');
        setIo(io);
        socketHandler(io);
        console.log('Socket handler initialized');
    } catch (err) {
        console.error('Failed to initialize socket handler:', err);
    }

    server.listen(port,()=>{
        console.log(`the app is listen at http://localhost:${port}`);
    })
} catch (error) {
    console.error("Server startup error:", error)
    process.exit(1)
}