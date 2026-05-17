"""
LinkedIn Easy Apply automation using Selenium + undetected-chromedriver.
Automates the application process for jobs on LinkedIn.
"""
import time
import random
import config


def auto_apply_linkedin(jobs: list, log_list: list, max_apps: int = None, wait_time: int = None):
    """
    Automatically apply to LinkedIn jobs using Easy Apply.
    
    Args:
        jobs: List of job dicts with job_url and source fields
        log_list: Shared log list for real-time UI updates
        max_apps: Maximum number of applications per session
        wait_time: Seconds to wait between applications
    """
    max_apps = max_apps or config.MAX_APPLICATIONS_PER_SESSION
    wait_time = wait_time or config.WAIT_BETWEEN_APPLICATIONS

    if not config.LINKEDIN_EMAIL or not config.LINKEDIN_PASSWORD:
        log_list.append({"type": "error", "message": "❌ LinkedIn credentials not configured. Add LINKEDIN_EMAIL and LINKEDIN_PASSWORD to .env file."})
        return 0

    # Filter to LinkedIn jobs that haven't been applied to
    linkedin_jobs = [
        j for j in jobs
        if j.get("source", "").lower() == "linkedin"
        and j.get("status", "").lower() == "not applied"
        and j.get("job_url", "")
    ]

    if not linkedin_jobs:
        log_list.append({"type": "info", "message": "ℹ️ No unapplied LinkedIn jobs found."})
        return 0

    # Limit to max applications
    jobs_to_apply = linkedin_jobs[:max_apps]
    log_list.append({"type": "progress", "message": f"⚡ Starting auto-apply for {len(jobs_to_apply)} LinkedIn jobs..."})

    applied_count = 0

    try:
        import undetected_chromedriver as uc
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        from selenium.common.exceptions import TimeoutException, NoSuchElementException

        # Setup Chrome driver
        log_list.append({"type": "progress", "message": "⚡ Launching Chrome browser..."})
        options = uc.ChromeOptions()
        options.add_argument("--start-maximized")
        options.add_argument("--disable-blink-features=AutomationControlled")

        driver = uc.Chrome(options=options)

        try:
            # Login to LinkedIn
            log_list.append({"type": "progress", "message": "⚡ Logging into LinkedIn..."})
            driver.get("https://www.linkedin.com/login")
            time.sleep(3)

            # Enter credentials
            email_field = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.ID, "username"))
            )
            email_field.send_keys(config.LINKEDIN_EMAIL)

            password_field = driver.find_element(By.ID, "password")
            password_field.send_keys(config.LINKEDIN_PASSWORD)

            # Click login button
            login_btn = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
            login_btn.click()
            time.sleep(5)

            # Check if login was successful
            if "checkpoint" in driver.current_url or "challenge" in driver.current_url:
                log_list.append({"type": "error", "message": "❌ LinkedIn security check detected. Please log in manually first."})
                driver.quit()
                return 0

            log_list.append({"type": "success", "message": "✅ Successfully logged into LinkedIn!"})

            # Apply to each job
            for i, job in enumerate(jobs_to_apply):
                job_url = job["job_url"]
                company = job.get("company", "Unknown")
                title = job.get("title", "Unknown")

                log_list.append({"type": "progress", "message": f"⚡ [{i+1}/{len(jobs_to_apply)}] Applying to {title} at {company}..."})

                try:
                    driver.get(job_url)
                    time.sleep(random.uniform(3, 5))

                    # Look for Easy Apply button
                    try:
                        easy_apply_btn = WebDriverWait(driver, 8).until(
                            EC.presence_of_element_located((By.CSS_SELECTOR, ".jobs-apply-button, button[aria-label*='Easy Apply']"))
                        )
                        easy_apply_btn.click()
                        time.sleep(2)

                        # Try to submit the application
                        # Look for submit/next buttons in the modal
                        max_steps = 5
                        for step in range(max_steps):
                            try:
                                # Check for submit button first
                                submit_btns = driver.find_elements(By.CSS_SELECTOR, "button[aria-label*='Submit'], button[aria-label*='submit']")
                                if submit_btns:
                                    submit_btns[0].click()
                                    time.sleep(2)
                                    applied_count += 1
                                    job["status"] = "Applied"
                                    log_list.append({"type": "success", "message": f"   ✅ Applied to {title} at {company}!"})
                                    break

                                # Check for next/continue button
                                next_btns = driver.find_elements(By.CSS_SELECTOR, "button[aria-label*='Continue'], button[aria-label*='Next'], button[aria-label*='Review']")
                                if next_btns:
                                    next_btns[0].click()
                                    time.sleep(2)
                                    continue

                                # If no buttons found, try generic footer button
                                footer_btns = driver.find_elements(By.CSS_SELECTOR, ".jobs-easy-apply-modal footer button.artdeco-button--primary")
                                if footer_btns:
                                    footer_btns[-1].click()
                                    time.sleep(2)
                                    continue

                                break

                            except Exception:
                                break

                        # Close any open modal
                        try:
                            dismiss_btns = driver.find_elements(By.CSS_SELECTOR, "button[aria-label='Dismiss'], button[aria-label='Discard']")
                            if dismiss_btns:
                                dismiss_btns[0].click()
                                time.sleep(1)
                                discard_btns = driver.find_elements(By.CSS_SELECTOR, "button[data-control-name='discard_application_confirm_btn']")
                                if discard_btns:
                                    discard_btns[0].click()
                                    time.sleep(1)
                        except Exception:
                            pass

                    except TimeoutException:
                        log_list.append({"type": "info", "message": f"   ⏭️ No Easy Apply button for {title} at {company} — skipping"})
                        continue

                except Exception as e:
                    log_list.append({"type": "error", "message": f"   ❌ Error applying to {title}: {str(e)}"})

                # Wait between applications
                if i < len(jobs_to_apply) - 1:
                    jitter = random.uniform(wait_time * 0.8, wait_time * 1.3)
                    log_list.append({"type": "info", "message": f"   ⏳ Waiting {int(jitter)}s before next application..."})
                    time.sleep(jitter)

        finally:
            driver.quit()
            log_list.append({"type": "info", "message": "🌐 Browser closed."})

    except ImportError:
        log_list.append({"type": "error", "message": "❌ undetected-chromedriver not installed. Run: pip install undetected-chromedriver"})
        return 0
    except Exception as e:
        log_list.append({"type": "error", "message": f"❌ Auto-apply error: {str(e)}"})

    log_list.append({"type": "success", "message": f"✅ Auto-apply complete! Applied to {applied_count} jobs."})
    return applied_count
