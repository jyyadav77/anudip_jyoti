require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const session = require("express-session");
const jwt = require("jsonwebtoken");
const path = require("path");
const multer = require("multer")
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser")
const fs = require("fs");




const app = express();
const port = process.env.PORT || 5000;
const secretKey = "your_secret_key"; // Change this to a secure key


// Session middleware
app.use(session({
  secret: 'mkcsdmofmdasom', // Replace with your own secret key
  resave: false,
  saveUninitialized: true
}));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "uploads")); // Save files to the "uploads" directory
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname); // Unique filename
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed!"), false);
  }
};

const upload = multer({ 
  dest: "uploads/",
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB file size limit
});

// Middleware
app.use(cors());
app.use(express.json()); // Body parser
app.use(express.static("public")); // Serve static files

app.use(express.json()); // To parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // To parse form data
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // Serve uploaded file
const frontendPath = path.join(__dirname, "../frontend");
app.use(express.static(frontendPath));

// Route to serve the certificate.html file
app.get("/certificate", (req, res) => {
    res.sendFile(path.join(frontendPath, "certificate.html"));
});

app.get("/data", (req, res) => {
  res.sendFile(path.join(frontendPath, "data.html"));
});


// MongoDB connection
mongoose.connect("mongodb://localhost:27017/SY", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));

// Serve HTML pages
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "/hp.html")));
app.get("/reg", (req, res) => res.sendFile(path.join(__dirname, "/reg.html")));
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "/login.html")));





app.use(express.static("C:/Users/jy865/OneDrive/New folder/Documents/skillsphere")); // Serves frontend files

app.get("/comp", (req, res) => {
    res.sendFile(path.join("C:/Users/jy865/OneDrive/New folder/Documents/skillsphere", "comp.html"));
});


let otpStore = {}; // Temporary storage for OTPs

// Configure your email transport
let transporter = nodemailer.createTransport({
  service: 'Gmail', // Use your email service
  auth: {
      user: 'sagaryadav23july20004@gmail.com', // Your email
      pass: 'fxqa ellj wykv dvtj', // Your email password
  },
});

app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  // Check if the user exists
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({ message: "Email not found." });
  }

  async function sendOtp(email) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Generate a 6-digit OTP
    otpStore[email] = otp; // Store the OTP for the email
    return otp; // Return the OTP
  };

  const otp = await sendOtp(email); // Get the OTP
  res.json({ message: "OTP sent to your email." });

  await transporter.sendMail({
    from: 'sagaryadav23july20004@gmail.com', // Your email
    to: email,
    subject: 'Your OTP for Password Reset',
    text: `Your OTP is: ${otp}. It is valid for 10 minutes.`,
  });
});

   
//Route to verify OTP and reset password
app.post('/verify-otp', async (req, res) => {
  const { email, otp, newPassword } = req.body;

  // Verify OTP
  if (otpStore[email] && otpStore[email] === otp) {
      // Update the user's password in the database
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await Student.updateOne({ email }, { password: hashedPassword });

      delete otpStore[email]; // Clear OTP after use
      res.json({ message: "Password reset successfully." });
  } else {
      res.status(400).json({ message: "Invalid OTP." });
  }
});




// User Schema
// Define the user schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 32 },
  email: { type: String, required: true, unique: true },
  contact: { type: String, required: true, minlength: 10, maxlength: 10 },
  password: { type: String, required: true, minlength: 8 }, // Removed maxlength for password
});

// Define the User model
const User = mongoose.model("User", userSchema);

// Registration Route
app.post("/REGIS", async (req, res) => {
  try {
    const { name, email, contact, password, confirmPassword } = req.body;

    // Check for missing fields
    if (!name || !email || !contact || !password || !confirmPassword) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match." });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Email already in use." });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create a new user
    const newUser = new User({ name, email, contact, password: hashedPassword });

    // Save the new user to the database
    await newUser.save();

    res.status(200).json({ success: true, message: "Registration successful!" });
  } catch (err) {
    console.error("Error registering user:", err);
    res.status(500).json({ success: false, message: "Error registering user." });
  }
});

// **Login Route**
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  console.log("📩 Request Body:", req.body);

  try {
    // Find user (case-insensitive)
    const user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, "i") } });
    console.log("🛑 User from DB:", user);

    if (!user) {
      console.log("❌ User not found!");
      return res.status(400).json({ success: false, message: "Invalid email or password." });
    }

    // Compare entered password with hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("❌ Password does not match!");
      return res.status(400).json({ success: false, message: "Invalid email or password." });
    }

    // Generate JWT token (expires in 30 minutes)
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      secretKey,
      { expiresIn: "5s" }
    );

    console.log("✅ Login successful!");
    res.status(200).json({
      success: true,
      message: "Login successful!",
      token,
      redirectUrl: "/profile.html"
    });
  } catch (err) {
    console.error("🔥 Login error:", err);
    res.status(500).json({ success: false, message: "Login error." });
  }
});

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  cgpa: { type: Number, required: true },
  skills: { type: String, required: true },
  contact: { type: String, required: true },
  profileImage: { type: String }, // Optional field
});

const Student = mongoose.model("Student", studentSchema);

// Route to save profile with file upload
app.post("/saveProfile", upload.single("profileImage"), async (req, res) => {
  console.log("Uploaded file:", req.file); // Debugging
  try {
    const { name, email, cgpa, skills, contact } = req.body;
    const profileImage = req.file ? `/uploads/${req.file.filename}` : ""; // File path

    // Validate request
    if (!name || !email || !cgpa || !skills || !contact) {
      return res.status(400).json({ success: false, message: "All fields are required!" });
    }

    let student = await Student.findOne({ email });

    if (student) {
      // Update existing profile
      student.name = name;
      student.cgpa = cgpa;
      student.skills = skills;
      student.contact = contact;
      if (profileImage) student.profileImage = profileImage;
    } else {
      // Create new profile
      student = new Student({ name, email, cgpa, skills, contact, profileImage });
    }

    await student.save();
    console.log("Profile saved:", student); // Debugging
    res.json({ success: true, message: "Profile saved successfully!" });
  } catch (error) {
    console.error("Error saving profile:", error);
    res.status(500).json({ success: false, message: "Server error!" });
  }
});
app.get("/getProfile", async (req, res) => {
  const { email } = req.query;

  try {
      const student = await Student.findOne({ email });
      if (!student) {
          return res.status(404).json({ success: false, message: "Participant not found" });
      }

      res.json({ success: true, student });
  } catch (error) {
      console.error("Error fetching participant details:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
  }
});
// Route to get profile by email
app.get("/getProfile/:email", async (req, res) => {
  try {
    const student = await Student.findOne({ email: req.params.email });

    if (!student) {
      return res.status(404).json({ success: false, message: "Profile not found!" });
    }

    res.json({ success: true, profile: student });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ success: false, message: "Server error!" });
  }
});



/*Schema for jobs*/
const JobApplication = mongoose.model(
  "JobApplication",
  new mongoose.Schema({
    name: String,
    email: String,
    phone: String,
    experience: Number,
    resume: String, // Store the file path
  })
);

app.post("/apply", upload.single("resume"), async (req, res) => {
  try {
    const { name, email, phone, experience } = req.body;
    const resume = req.file ? `/uploads/${req.file.filename}` : ""; // File path

    const newApplication = new JobApplication({
      name,
      email,
      phone,
      experience,
      resume,
    });

    await newApplication.save();

    res.json({ success: true, message: "Application submitted successfully!" });
  } catch (error) {
    console.error("Error saving application:", error);
    res.status(500).json({ success: false, message: "Error submitting application." });
  }
});

/*
  GET /getApplication/:email
  This route fetches a job application based on the applicant's email.
*/
app.get("/getApplication/:email", async (req, res) => {
  try {
    const application = await JobApplication.findOne({ email: req.params.email });
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found." });
    }
    res.status(200).json({ success: true, application });
  } catch (error) {
    console.error("Error fetching application:", error);
    res.status(500).json({ success: false, message: "Error fetching application." });
  }
});



const enrollmentSchema = new mongoose.Schema({
  name: String,
  email: String,
  date: Date
});

const Enrollment = mongoose.model("Enrollment", enrollmentSchema);

// POST Route to Handle Enrollment
app.post("/enroll", async (req, res) => {
  try {
      const { name, email, date } = req.body;

      // Create a new enrollment document
      const newEnrollment = new Enrollment({
          name,
          email,
          date: new Date(date)
      });

      // Save the document to the database
      await newEnrollment.save();

      // Send success response
      res.status(201).json({ message: "Enrollment successful!" });
  } catch (error) {
      console.error("Error:", error);
      res.status(500).json({ message: "Enrollment failed. Please try again." });
  }
});












const registrationseminarSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  college: String,
  registeredAt: { type: Date, default: Date.now }
});

const Registration = mongoose.model("Registration", registrationseminarSchema);


const contactUsSchema = new mongoose.Schema({
  name: String,
  email: String,
  message: String,
  submittedAt: { type: Date, default: Date.now }
});

const ContactUs = mongoose.model("ContactUs", contactUsSchema);

app.post("/submit_query", async (req, res) => {
  try {
    const { name, email, message } = req.body;
    const newQuery = new ContactUs({ name, email, message });
    await newQuery.save();

    // Send confirmation email
    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: { user: 'sagaryadav23july20004@gmail.com', pass: 'fxqa ellj wykv dvtj' }
    });

    const mailOptions = {
      from: 'sagaryadav23july20004@gmail.com',
      to: email,
      subject: 'Query Submission Confirmation',
      text: `Hello ${name},\n\nThank you for reaching out to us. We have received your message and will get back to you soon.\n\nBest Regards,\nSkillSphere Team`
    };

    await transporter.sendMail(mailOptions);
    res.status(201).json({ message: "Query submitted successfully and email sent Our Team Connect Shortly!" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Submission failed. Please try again." });
  }
});
// Fetch Job Applications
app.get("/apply", async (req, res) => {
  try {
    const applications = await JobApplication.find({});
    res.json({ success: true, data: applications });
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).json({ success: false, message: "Error fetching applications." });
  }
});

// Register for Seminar

app.post("/register", async (req, res) => {
  try {
    const { name, email, phone, college } = req.body;

    // Validate input
    if (!name || !email || !phone || !college) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Save registration to the database
    const newRegistration = new Registration({ name, email, phone, college });
    await newRegistration.save();

    // Send confirmation email
    const mailOptions = {
      from: process.env.EMAIL_USER, // Use environment variables for security
      to: email,
      subject: "Seminar Registration Confirmation",
      text: `Hello ${name},\n\nThank you for registering for the seminar.\n\nBest Regards,\nSeminar Team`,
    };

    await transporter.sendMail(mailOptions);

    res.status(201).json({ message: "Registration successful and email sent!" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Registration failed. Please try again." });
  }
});

// Fetch Seminar Registrations
app.get("/register", async (req, res) => {
  try {
    const registrations = await Registration.find({}, { phone: 1, college: 1, name: 1, _id: 0 });
    res.json({ success: true, data: registrations });
  } catch (error) {
    console.error("Error fetching registrations:", error);
    res.status(500).json({ success: false, message: "Error fetching registrations." });
  }
});




/*
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Route to upload the certificate as base64 and save it as PDF
app.post("/uploadCertificate", async (req, res) => {
    try {
        const { pdfData } = req.body;

        if (!pdfData) {
            return res.status(400).json({ error: "No PDF data received" });
        }

        // Extract the base64 PDF data (remove data URL prefix)
        const base64Data = pdfData.split(",")[1];

        // Define the file path to save the PDF
        const pdfPath = path.join(__dirname, "uploads", "Certificate.pdf");

        // Write the PDF file to the disk
        fs.writeFileSync(pdfPath, Buffer.from(base64Data, "base64"));

        // Optional: Send an email with the saved PDF
        await sendEmailWithAttachment(pdfPath);

        res.json({ message: "Certificate saved and email sent successfully!" });
    } catch (error) {
        console.error("Error uploading and saving certificate:", error);
        res.status(500).json({ error: "Failed to save or send the certificate" });
    }
});

// Function to send email with the saved certificate as an attachment
async function sendEmailWithAttachment(pdfPath) {
    let transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: "sagaryadav23july20004@gmail.com", // Replace with your email
            pass: "fxqa ellj wykv dvtj", // Replace with your app password
        },
    });

    let mailOptions = {
        from: "sagaryadav23july20004@gmail.com",
        to: email, // Replace with recipient email
        subject: "Your Course Completion Certificate",
        text: "Congratulations on completing the course! Please find your certificate attached.",
        attachments: [
            {
                filename: "Certificate.pdf",
                path: pdfPath,
            },
        ],
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log("Email sent successfully!");
    } catch (error) {
        console.error("Error sending email:", error);
    }
}
*/




// Start server
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
