// export APPLICATIONINSIGHTS_CONNECTION_STRING="InstrumentationKey=9817e97a-9b95-44fd-8784-bf1e8df638f4;IngestionEndpoint=https://centralus-2.in.applicationinsights.azure.com/;LiveEndpoint=https://centralus.livediagnostics.monitor.azure.com/;ApplicationId=2ef42359-73c8-48ae-8b6b-b9049430052c"
const express = require("express");
const appInsights = require("applicationinsights");

// Initialize Application Insights
// You'll need to set APPLICATIONINSIGHTS_CONNECTION_STRING environment variable
// or replace with your connection string
appInsights
  .setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
  .setAutoDependencyCorrelation(true)
  .setAutoCollectRequests(true)
  .setAutoCollectPerformance(true, true)
  .setAutoCollectExceptions(true)
  .setAutoCollectDependencies(true)
  .setAutoCollectConsole(true)
  .setUseDiskRetryCaching(true)
  .setSendLiveMetrics(false)
  .start();

const client = appInsights.defaultClient;

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json({ limit: "10mb" }));

// Middleware to log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// POST /api/v2/visits endpoint
app.post("/api/v2/visits", (req, res) => {
  try {
    // Log the request to Application Insights
    client.trackEvent({
      name: "VisitRequest",
      properties: {
        method: req.method,
        url: req.originalUrl,
        userAgent: req.get("User-Agent"),
        ip: req.ip,
        timestamp: new Date().toISOString(),
      },
    });

    // Log the request body as a separate event
    client.trackEvent({
      name: "VisitRequestBody",
      properties: {
        requestBody: JSON.stringify(req.body),
        contentLength: req.get("Content-Length"),
        contentType: req.get("Content-Type"),
      },
    });

    // Log to console as well
    console.log(
      "POST /api/v2/visits - Request Body:",
      JSON.stringify(req.body, null, 2)
    );

    // Your business logic here
    // For now, just echo back the received data
    const response = {
      success: true,
      message: "Visit data received successfully",
      timestamp: new Date().toISOString(),
      receivedData: req.body,
    };

    // Log successful response
    client.trackEvent({
      name: "VisitResponse",
      properties: {
        success: true,
        statusCode: 200,
      },
    });

    res.status(200).json(response);
  } catch (error) {
    // Log errors to Application Insights
    client.trackException({
      exception: error,
      properties: {
        endpoint: "/api/v2/visits",
        method: "POST",
      },
    });

    console.error("Error processing visit request:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
      timestamp: new Date().toISOString(),
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// Handle 404
app.use("*", (req, res) => {
  client.trackEvent({
    name: "404NotFound",
    properties: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
    },
  });

  res.status(404).json({
    success: false,
    message: "Endpoint not found",
    timestamp: new Date().toISOString(),
  });
});

// Global error handler
app.use((error, req, res, next) => {
  client.trackException({
    exception: error,
    properties: {
      url: req.originalUrl,
      method: req.method,
    },
  });

  console.error("Unhandled error:", error);

  res.status(500).json({
    success: false,
    message: "Internal server error",
    timestamp: new Date().toISOString(),
  });
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down gracefully...");

  // Flush any pending telemetry
  client.flush({
    callback: () => {
      console.log("Application Insights telemetry flushed");
      process.exit(0);
    },
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Log server start event
  client.trackEvent({
    name: "ServerStarted",
    properties: {
      port: PORT,
      timestamp: new Date().toISOString(),
    },
  });
});
