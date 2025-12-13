export const passwordResetTemplate = (name, otp) => {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Password Reset</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        background-color: #f8f9fa;
        margin: 0;
        padding: 0;
      }
      .container {
        max-width: 600px;
        margin: 30px auto;
        background: #ffffff;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        padding: 20px;
      }
      .header {
        text-align: center;
        padding-bottom: 20px;
        border-bottom: 1px solid #eee;
      }
      .header h1 {
        color: #333;
      }
      .content {
        padding: 20px;
        color: #333;
      }
      .otp {
        font-size: 24px;
        font-weight: bold;
        color: #007bff;
        margin: 20px 0;
        text-align: center;
      }
      .footer {
        text-align: center;
        font-size: 12px;
        color: #777;
        margin-top: 30px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🔒 Password Reset Request</h1>
      </div>
      <div class="content">
        <p>Hi <b>${name}</b>,</p>
        <p>We received a request to reset your password. Use the OTP below to reset it:</p>
        <div class="otp">${otp}</div>
        <p>This OTP is valid for the next <b>10 minutes</b>. If you did not request this, please ignore this email.</p>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} Tipu Mobiles. All rights reserved.</p>
      </div>
    </div>
  </body>
  </html>
  `;
};

export const receivedReviewTemplate = (
  userName,
  productName,
  reviewText,
  rating,
  approveUrl
) => {
  return `
    <!DOCTYPE html>
    <html>
  <head>
    <meta charset="UTF-8" />
    <title>New Product Review Submitted</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        background-color: #f6f6f6;
        margin: 0;
        padding: 0;
      }
      .container {
        background-color: #ffffff;
        max-width: 600px;
        margin: 30px auto;
        padding: 20px;
        border-radius: 6px;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
      }
      .header {
        border-bottom: 1px solid #eee;
        padding-bottom: 10px;
        margin-bottom: 20px;
      }
      .header h2 {
        margin: 0;
        color: #333;
      }
      .content p {
        line-height: 1.6;
        color: #555;
      }
      .review-box {
        background-color: #f9f9f9;
        border-left: 4px solid #007bff;
        padding: 15px;
        margin: 20px 0;
        font-style: italic;
      }
      .btn {
        display: inline-block;
        padding: 10px 20px;
        background-color: #28a745;
        color: #ffffff;
        text-decoration: none;
        border-radius: 4px;
        margin-top: 10px;
      }
      .footer {
        font-size: 12px;
        color: #999;
        text-align: center;
        margin-top: 30px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h2>📝 New Product Review Submitted</h2>
      </div>

      <div class="content">
        <p><strong>${userName}</strong> has just submitted a review for the product:</p>
        <p><strong>🛍️ ${productName}</strong></p>

        <div class="review-box">
          "${reviewText}"
        </div>

        <p>Rating: ⭐ ${rating}/5</p>

        <p>Please review and approve this submission if it meets your standards.</p>

        <a class="btn" href="{{approveUrl}}">Approve Review</a>
      </div>

      <div class="footer">
        You’re receiving this email because you're an admin of Tipu Moblies Website.
      </div>
    </div>
  </body>
</html>
    `;
};

export const receivedReviewReplyByAdminTemplate = (
  userName,
  productName,
  reviewTitle,
  reviewText,
  adminReply,
  rating
) => {
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Your Review Was Approved</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        background-color: #f4f4f4;
        margin: 0;
        padding: 20px;
      }
      .container {
        max-width: 600px;
        background-color: #ffffff;
        margin: 0 auto;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }
      h2 {
        color: #333;
      }
      .product-title {
        font-size: 18px;
        font-weight: bold;
        margin: 10px 0;
      }
      .section-title {
        font-weight: bold;
        margin-top: 20px;
        color: #444;
      }
      .box {
        background-color: #f9f9f9;
        border-left: 4px solid #007bff;
        padding: 15px;
        border-radius: 4px;
        color: #555;
        margin: 10px 0;
      }
      .rating {
        font-size: 14px;
        color: #f39c12;
        margin-top: 5px;
      }
      .button {
        display: inline-block;
        padding: 10px 20px;
        background-color: #007bff;
        color: white;
        text-decoration: none;
        border-radius: 5px;
        font-weight: bold;
        margin-top: 20px;
      }
      .footer {
        text-align: center;
        margin-top: 30px;
        font-size: 12px;
        color: #999;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h2>✅ Your Review Has Been Approved!</h2>

      <p>Hi ${userName},</p>

      <p>Thanks for sharing your thoughts about:</p>
      <div class="product-title">🛍️ ${productName}</div>

      <div class="section-title">📝 Your Review</div>
      <div class="box">
        <strong>${reviewTitle}}</strong><br />
        "${reviewText}"
        <div class="rating">⭐ Rating: ${rating}/5</div>
      </div>

      <div class="section-title">📣 Admin Reply</div>
      <div class="box">
        "${adminReply}"
      </div>

      <a href="{{reviewUrl}}" class="button">View Your Review</a>

      <div class="footer">
        This is a notification from Tipu Moblies. You are receiving this because you submitted a product review.
      </div>
    </div>
  </body>
</html>

`;
};
