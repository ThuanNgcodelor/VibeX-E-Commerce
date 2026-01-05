package com.example.authservice.service;

import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Year;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

  private final JavaMailSender mailSender;

  @Value("${app.mail.from:no-reply@example.com}")
  private String from;

  @Value("${app.mail.brand:Your Company}")
  private String brand;

  @Value("${app.mail.otp-subject:Password Reset Code}")
  private String otpSubject;

  public boolean sendOtpEmail(String to, String otp, int minutesValid) {
    try {
      MimeMessage message = mailSender.createMimeMessage();

      // multipart=true để set cả plain & html
      MimeMessageHelper helper = new MimeMessageHelper(
          message,
          MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED,
          StandardCharsets.UTF_8.name());

      helper.setTo(to);
      helper.setFrom(from);
      helper.setSubject(otpSubject);

      String html = buildOtpHtml(otp, minutesValid, brand);
      String plain = buildOtpPlainText(otp, minutesValid, brand);

      // set text (plain, html)
      helper.setText(plain, html);

      mailSender.send(message);
      return true;
    } catch (MailException ex) {
      log.error("Failed to send OTP email to {}: {}", to, ex.getMessage(), ex);
      return false;
    } catch (Exception ex) {
      log.error("Unexpected error sending OTP email to {}: {}", to, ex.getMessage(), ex);
      return false;
    }
  }

  /**
   * Plain text fallback để client mail không hỗ trợ HTML vẫn đọc được.
   */
  public static String buildOtpPlainText(String otp, int minutesValid, String brand) {
    return """
        Forgot your password?
        Use the code below to reset your password.

        OTP: %s
        This code expires in %d minutes.

        If you didn't request this, you can safely ignore this email.

        © %d %s. All rights reserved.
        """.formatted(otp, minutesValid, Year.now().getValue(), brand);
  }

  /**
   * HTML template cho OTP.
   * Lưu ý: đã escape %% cho các thuộc tính style width=\"100%%\".
   */
  public static String buildOtpHtml(String otp, int minutesValid, String brand) {
    return """
        <!doctype html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>Password Reset Code</title>
        </head>
        <body style="margin:0;background:#f6f9fc;font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
          <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%%" style="max-width:520px;background:#ffffff;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.06);">
                  <tr>
                    <td style="padding:28px 28px 8px;text-align:center;">
                      <div style="font-size:18px;font-weight:700;color:#ef4444;margin-bottom:4px;">Forgot your password?</div>
                      <div style="font-size:14px;color:#6b7280;">Use the code below to reset your password.</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 28px 0;text-align:center;">
                      <div style="display:inline-block;padding:14px 20px;border-radius:10px;background:#f3f4f6;border:1px solid #e5e7eb;letter-spacing:6px;font-size:24px;font-weight:700;">
                        %s
                      </div>
                      <div style="margin-top:10px;font-size:12px;color:#6b7280;">This code expires in %d minutes.</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:16px 28px 24px;">
                      <p style="font-size:13px;line-height:1.6;margin:16px 0;color:#4b5563;">
                        If you didn't request this, you can safely ignore this email.
                      </p>
                      <hr style="border:none;border-top:1px solid #f1f5f9;margin:16px 0;">
                      <div style="font-size:12px;color:#94a3b8;text-align:center;">
                        © %d %s. All rights reserved.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
        """
        .formatted(otp, minutesValid, Year.now().getValue(), brand);
  }

  /**
   * Gửi email thông báo khi admin cập nhật thông tin user
   */
  public boolean sendUserUpdateEmail(String to, String username, String firstName, String lastName) {
    try {
      MimeMessage message = mailSender.createMimeMessage();

      MimeMessageHelper helper = new MimeMessageHelper(
          message,
          MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED,
          StandardCharsets.UTF_8.name());

      helper.setTo(to);
      helper.setFrom(from);
      helper.setSubject("Your Account Information Has Been Updated");

      String html = buildUserUpdateHtml(username, firstName, lastName, brand);
      String plain = buildUserUpdatePlainText(username, firstName, lastName, brand);

      helper.setText(plain, html);

      mailSender.send(message);
      log.info("Successfully sent user update email to: {}", to);
      return true;
    } catch (MailException ex) {
      log.error("Failed to send user update email to {}: {}", to, ex.getMessage(), ex);
      return false;
    } catch (Exception ex) {
      log.error("Unexpected error sending user update email to {}: {}", to, ex.getMessage(), ex);
      return false;
    }
  }

  /**
   * Plain text fallback cho email thông báo update user
   */
  public static String buildUserUpdatePlainText(String username, String firstName, String lastName, String brand) {
    String displayName = buildDisplayName(firstName, lastName, username);
    return """
        Your Account Has Been Updated

        Hi %s,

        This email is to inform you that an administrator has updated your account information.

        If you did not request this change or notice any unauthorized modifications,
        please contact our support team immediately.

        Thank you,
        %s Team

        © %d %s. All rights reserved.
        """.formatted(displayName, brand, Year.now().getValue(), brand);
  }

  /**
   * HTML template cho email thông báo update user
   */
  public static String buildUserUpdateHtml(String username, String firstName, String lastName, String brand) {
    String displayName = buildDisplayName(firstName, lastName, username);
    return """
        <!doctype html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>Account Updated</title>
        </head>
        <body style="margin:0;background:#f6f9fc;font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
          <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%%" style="max-width:520px;background:#ffffff;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.06);">
                  <tr>
                    <td style="padding:28px 28px 8px;text-align:center;">
                      <div style="font-size:18px;font-weight:700;color:#3b82f6;margin-bottom:4px;">Your Account Has Been Updated</div>
                      <div style="font-size:14px;color:#6b7280;">An administrator has modified your account information</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 28px 0;text-align:center;">
                      <div style="display:inline-block;padding:16px 24px;border-radius:10px;background:#eff6ff;border:1px solid #dbeafe;margin:12px 0;">
                        <div style="font-size:14px;color:#6b7280;margin-bottom:4px;">Hello,</div>
                        <div style="font-size:18px;font-weight:600;color:#1f2937;">%s</div>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:16px 28px 24px;">
                      <p style="font-size:13px;line-height:1.6;margin:16px 0;color:#4b5563;">
                        This email is to inform you that an administrator has updated your account information.
                      </p>
                      <p style="font-size:13px;line-height:1.6;margin:16px 0;color:#4b5563;">
                        If you did not request this change or notice any unauthorized modifications,
                        please contact our support team immediately.
                      </p>
                      <hr style="border:none;border-top:1px solid #f1f5f9;margin:16px 0;">
                      <div style="font-size:12px;color:#94a3b8;text-align:center;">
                        © %d %s. All rights reserved.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
        """
        .formatted(displayName, Year.now().getValue(), brand);
  }

  /**
   * Helper method để build display name từ firstName, lastName, hoặc fallback về
   * username
   */
  private static String buildDisplayName(String firstName, String lastName, String username) {
    if (firstName != null && !firstName.isBlank() && lastName != null && !lastName.isBlank()) {
      return firstName + " " + lastName;
    } else if (firstName != null && !firstName.isBlank()) {
      return firstName;
    } else if (lastName != null && !lastName.isBlank()) {
      return lastName;
    } else {
      return username != null ? username : "User";
    }
  }

  /**
   * Gửi email thông báo khi account bị khóa hoặc mở khóa
   */
  public boolean sendUserLockStatusEmail(String to, String username, String firstName, String lastName,
      boolean locked) {
    try {
      MimeMessage message = mailSender.createMimeMessage();

      MimeMessageHelper helper = new MimeMessageHelper(
          message,
          MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED,
          StandardCharsets.UTF_8.name());

      helper.setTo(to);
      helper.setFrom(from);

      String subject = locked ? "Account Locked Notification" : "Account Unlocked Notification";
      helper.setSubject(subject);

      String html = buildUserLockStatusHtml(username, firstName, lastName, locked, brand);
      String plain = buildUserLockStatusPlainText(username, firstName, lastName, locked, brand);

      helper.setText(plain, html);

      mailSender.send(message);
      log.info("Successfully sent user lock status email (locked={}) to: {}", locked, to);
      return true;
    } catch (MailException ex) {
      log.error("Failed to send user lock status email to {}: {}", to, ex.getMessage(), ex);
      return false;
    } catch (Exception ex) {
      log.error("Unexpected error sending user lock status email to {}: {}", to, ex.getMessage(), ex);
      return false;
    }
  }

  public static String buildUserLockStatusPlainText(String username, String firstName, String lastName, boolean locked,
      String brand) {
    String displayName = buildDisplayName(firstName, lastName, username);
    String actionParams = locked ? "locked" : "unlocked";
    String messageBody = locked
        ? "Your account has been locked by an administrator. Please contact support if you believe this is an error."
        : "Your account has been unlocked. You can now access your account.";

    return """
        Account %s Notification

        Hi %s,

        %s

        Thank you,
        %s Team

        © %d %s. All rights reserved.
        """.formatted(
        locked ? "Locked" : "Unlocked",
        displayName,
        messageBody,
        brand,
        Year.now().getValue(),
        brand);
  }

  public static String buildUserLockStatusHtml(String username, String firstName, String lastName, boolean locked,
      String brand) {
    String displayName = buildDisplayName(firstName, lastName, username);
    String title = locked ? "Account Locked" : "Account Unlocked";
    String color = locked ? "#ef4444" : "#10b981"; // Red for lock, Green for unlock
    String messageBody = locked
        ? "Your account has been locked by an administrator.<br/>Please contact support if you believe this is an error."
        : "Your account has been unlocked.<br/>You can now access your account.";

    return """
        <!doctype html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>%s</title>
        </head>
        <body style="margin:0;background:#f6f9fc;font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
          <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%%" style="max-width:520px;background:#ffffff;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.06);">
                  <tr>
                    <td style="padding:28px 28px 8px;text-align:center;">
                      <div style="font-size:18px;font-weight:700;color:%s;margin-bottom:4px;">%s</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 28px 0;text-align:center;">
                      <div style="display:inline-block;padding:16px 24px;border-radius:10px;background:#eff6ff;border:1px solid #dbeafe;margin:12px 0;">
                        <div style="font-size:14px;color:#6b7280;margin-bottom:4px;">Hello,</div>
                        <div style="font-size:18px;font-weight:600;color:#1f2937;">%s</div>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:16px 28px 24px; text-align:center;">
                      <p style="font-size:14px;line-height:1.6;margin:16px 0;color:#4b5563;">
                        %s
                      </p>
                      <hr style="border:none;border-top:1px solid #f1f5f9;margin:16px 0;">
                      <div style="font-size:12px;color:#94a3b8;text-align:center;">
                        © %d %s. All rights reserved.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
        """
        .formatted(title, color, title, displayName, messageBody, Year.now().getValue(), brand);
  }
}
