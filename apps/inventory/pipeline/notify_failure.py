"""
notify_failure.py
─────────────────
Standalone failure alerter for GitHub Actions.
No pipeline imports — must work even if main code has import errors.

Send order: SendGrid → Gmail SMTP → Slack webhook.
"""
import datetime
import json
import os
import smtplib
import urllib.request
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

TODAY = datetime.date.today().isoformat()
SUBJECT = f"PIPELINE FAILURE — Rypstick Inventory — {TODAY}"
BODY_HTML = f"""
<html><body style="font-family:Arial,sans-serif;font-size:14px;color:#333">
<h2 style="color:#c0392b">Pipeline Failure — {TODAY}</h2>
<p>The daily inventory pipeline <strong>failed to complete</strong>.</p>
<ul>
  <li>Inventory data was <strong>not updated</strong> today.</li>
  <li>The app is showing data from the last successful run.</li>
  <li>Check GitHub Actions logs for the error details.</li>
</ul>
<p>
  <a href="https://github.com" style="color:#2980b9">
    View GitHub Actions logs
  </a>
</p>
<p style="color:#888;font-size:12px;margin-top:20px">
  This is an automated failure notification from the Rypstick inventory pipeline.
</p>
</body></html>
"""
BODY_TEXT = (
    f"PIPELINE FAILURE — {TODAY}\n\n"
    "The daily inventory pipeline failed to complete.\n"
    "Inventory data was NOT updated today.\n"
    "The app is showing data from the last successful run.\n"
    "Check GitHub Actions logs for details."
)


def send_sendgrid(from_addr, to_addrs):
    import sendgrid
    from sendgrid.helpers.mail import Content, Email, Mail, To
    sg = sendgrid.SendGridAPIClient(api_key=os.environ["SENDGRID_API_KEY"])
    mail = Mail(from_email=Email(from_addr), subject=SUBJECT)
    for addr in to_addrs:
        mail.add_to(To(addr.strip()))
    mail.add_content(Content("text/html", BODY_HTML))
    r = sg.client.mail.send.post(request_body=mail.get())
    print(f"SendGrid: {r.status_code}")


def send_gmail(from_addr, to_addrs):
    password = os.environ.get("EMAIL_PASSWORD","")
    if not password:
        raise EnvironmentError("EMAIL_PASSWORD not set for Gmail fallback.")
    msg = MIMEMultipart("alternative")
    msg["Subject"] = SUBJECT
    msg["From"] = from_addr
    msg["To"] = ", ".join(to_addrs)
    msg.attach(MIMEText(BODY_TEXT, "plain"))
    msg.attach(MIMEText(BODY_HTML, "html"))
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as s:
        s.login(from_addr, password)
        s.sendmail(from_addr, to_addrs, msg.as_string())
    print(f"Gmail: sent to {to_addrs}")


def send_slack(webhook_url):
    payload = json.dumps({
        "text": f":red_circle: *Pipeline Failure — {TODAY}*\n"
                "The daily inventory pipeline failed. Data not updated.\n"
                "Check GitHub Actions for details."
    }).encode()
    req = urllib.request.Request(
        webhook_url, data=payload,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        print(f"Slack: {r.status}")


def main():
    from_addr = os.environ.get("EMAIL_FROM","")
    to_str    = os.environ.get("EMAIL_TO","")
    to_addrs  = [a.strip() for a in to_str.split(",") if a.strip()]
    sg_key    = os.environ.get("SENDGRID_API_KEY","")
    slack_url = os.environ.get("SLACK_WEBHOOK_URL","")

    sent = False
    if from_addr and to_addrs:
        if sg_key:
            try:
                send_sendgrid(from_addr, to_addrs)
                sent = True
            except Exception as e:
                print(f"SendGrid failed: {e} — trying Gmail")
        if not sent:
            try:
                send_gmail(from_addr, to_addrs)
                sent = True
            except Exception as e:
                print(f"Gmail failed: {e}")

    if slack_url:
        try:
            send_slack(slack_url)
            sent = True
        except Exception as e:
            print(f"Slack failed: {e}")

    if not sent:
        print("No notification channels configured — failure not reported.")


if __name__ == "__main__":
    main()
