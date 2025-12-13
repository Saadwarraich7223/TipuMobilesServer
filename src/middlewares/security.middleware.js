// middlewares/security.middleware.js
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import { xss } from "express-xss-sanitizer";
// import csrf from "csurf";
import compression from "compression";

export const applySecurityMiddlewares = (
  app,
  { trustedOrigin = "*", env = "development" } = {}
) => {
  // 1. Basic parsers (do these in app.js before this if not done here)
  app.set("trust proxy", 1);
  // 2. HTTP headers protection

  app.use(
    helmet({
      contentSecurityPolicy: false, // enable and customize in production
    })
  );

  // 3. CORS — restrict origins in production
  app.use(
    cors({
      origin: env === "production" ? trustedOrigin : true,
      credentials: true,
    })
  );

  // 4. Gzip compression
  app.use(compression());

  // // 5. Rate limiting (global). More aggressive on auth routes (see below)
  // const globalLimiter = rateLimit({
  //   windowMs: 15 * 60 * 1000, // 15 minutes
  //   max: 200, // max requests per IP per window
  //   standardHeaders: true,
  //   legacyHeaders: false,
  // });
  // app.use(globalLimiter);

  // 6. Protect against HTTP parameter pollution (duplicate query params)
  app.use(hpp());

  // 7. Protect against XSS (input sanitation)
  app.use(xss());

  // 8. Prevent NoSQL injection by removing $ and . from inputs
  app.use((req, res, next) => {
    Object.defineProperty(req, "query", {
      ...Object.getOwnPropertyDescriptor(req, "query"),
      value: req.query,
      writable: true,
    });
    next();
  });
  app.use(mongoSanitize());

  // 9. CSRF protection (only enable if using cookie-based auth)
  // if (env === "production" || env === "staging") {
  //   // Use cookie-based CSRF tokens. For APIs using JWT in Authorization header, CSRF is less relevant.
  //   const csrfProtection = csrf({
  //     cookie: {
  //       httpOnly: true,
  //       sameSite: env === "production" ? "none" : "lax",
  //       secure: env === "production",
  //     },
  //   });
  //   app.use(csrfProtection);

  //   // Expose token endpoint (example)
  //   app.get("/csrf-token", (req, res) => {
  //     res.json({ csrfToken: req.csrfToken() });
  //   });
  // }

  // 10. Rate limit sensitive endpoints separately (example)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 6, // very strict for login/otp attempts
    message: "Too many attempts from this IP, try again after 15 minutes",
    standardHeaders: true,
    legacyHeaders: false,
  });

  // You use authLimiter on your auth routes:
  // app.use('/api/auth/login', authLimiter);
  // app.use('/api/auth/register', authLimiter);

  return { authLimiter };
};
