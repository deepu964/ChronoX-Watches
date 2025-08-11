const nodemailer = require('nodemailer');
require('dotenv').config();

const sendOtpEmail = async (email, otp) => {
  try {
    console.log('Sending OTP to email:', email);
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: 'chronox9645@gmail.com',
      to: email,
      subject: 'Your OTP for Signup',
      html: `<!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <title>Your OTP Code</title>
                        <style>
                        body {
                            font-family: Arial, sans-serif;
                            background-color: #f4f4f4;
                            padding: 20px;
                        }
                        .container {
                            background-color: #ffffff;
                            max-width: 500px;
                            margin: auto;
                            padding: 30px;
                            border-radius: 8px;
                            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
                        }
                        .otp {
                            font-size: 24px;
                            font-weight: bold;
                            color: #2c3e50;
                            margin: 20px 0;
                        }
                        .footer {
                            font-size: 12px;
                            color: #999;
                            margin-top: 30px;
                        }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                        <h2>Hello ,</h2>
                        <p>Use the following One-Time Password (OTP) to complete your action. This OTP is valid for the next 1 minutes.</p>
                        <div class="otp">${otp}</div>
                        <p>If you did not request this code, please ignore this email.</p>
                        <div class="footer">
                            <p>Thank you,<br/>chronox9645@gmail.com</p>
                        </div>
                        </div>
                    </body>
                    </html>
                    `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('OTP email sent:', info.response);
    return true;
  } catch (error) {
    console.error('Failed to send OTP:', error);
    return false;
  }
};

module.exports = sendOtpEmail;
