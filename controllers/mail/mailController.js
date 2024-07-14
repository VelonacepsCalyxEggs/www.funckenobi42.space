const nodemailer = require('nodemailer');
const config_nodemailer = require('../../config/nodemailerConfig'); // Import the configuration

const transporter = nodemailer.createTransport(config_nodemailer); // Use the configuration to create the transporter

exports.sendVerificationEmail = async (email, token) => {
    const verificationUrl = `http://www.funckenobi42.space/verify?token=${token}`;
  
    const mailOptions = {
      from: 'support@funckenobi42.space',
      to: email,
      subject: 'Please confirm your email',
      text: `Verify your account here: ${verificationUrl}`
    };
  
    try {
      await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error sending verification email', error);
    }
}