const nodemailer = require('nodemailer');
require('dotenv').config();

const sendResetPass = async (email, resetLink) => {
  try {
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
                        a{
                            text-decoration:none;
                        }
                        .btn{
                            width:fit-content;
                            padding:10px;
                            background-color:blue;
                            color:white;
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
                        <p>Please Click the below button for reset your password.</p>
                        <a href=${resetLink}> <button class="btn" > Reset your Password</button> </a>
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
    console.log('link email sent:', info.response);
    return true;
  } catch (error) {
    console.error('Failed to send link:', error);
    return false;
  }
};
module.exports = sendResetPass;
