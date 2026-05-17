"""
Job scraping logic using python-jobspy.
Searches multiple job boards, filters results, and saves to CSV.
"""
import uuid
import time
import pandas as pd
from datetime import datetime
from jobspy import scrape_jobs
import config


def _passes_title_filter(title: str) -> bool:
    """Check if a job title passes the include/exclude keyword filters."""
    title_lower = title.lower()

    # Must contain at least one include keyword
    has_include = any(kw.lower() in title_lower for kw in config.TITLE_INCLUDE_KEYWORDS)
    if not has_include:
        return False

    # Must not contain any exclude keyword
    has_exclude = any(kw.lower() in title_lower for kw in config.TITLE_EXCLUDE_KEYWORDS)
    if has_exclude:
        return False

    return True


def _load_existing_jobs() -> pd.DataFrame:
    """Load existing jobs from CSV, creating the file if it doesn't exist."""
    try:
        df = pd.read_csv(config.JOBS_CSV_PATH)
        return df
    except (FileNotFoundError, pd.errors.EmptyDataError):
        df = pd.DataFrame(columns=[
            "id", "title", "company", "location", "salary", "job_url",
            "source", "date_posted", "description", "status", "notes",
            "cover_letter_path", "date_added", "is_remote"
        ])
        df.to_csv(config.JOBS_CSV_PATH, index=False)
        return df


def _is_duplicate(job_url: str, existing_df: pd.DataFrame) -> bool:
    """Check if a job already exists in the CSV by URL."""
    if existing_df.empty or "job_url" not in existing_df.columns:
        return False
    return job_url in existing_df["job_url"].values


def search_jobs(
    log_list: list,
    job_titles: list = None,
    location: str = None,
    radius: int = None,
    results_per_search: int = None,
    include_remote: bool = None,
    max_days_old: int = None,
    min_salary: int = None,
    boards: list = None,
):
    """
    Search for jobs across configured job boards.
    Writes progress to log_list for real-time UI updates.
    """
    job_titles = job_titles or config.JOB_TITLES
    location = location or config.SEARCH_LOCATION
    radius = radius if radius is not None else config.RADIUS_MILES
    results_per_search = results_per_search or config.RESULTS_PER_SEARCH
    include_remote = include_remote if include_remote is not None else config.INCLUDE_REMOTE
    max_days_old = max_days_old if max_days_old is not None else config.MAX_DAYS_OLD
    min_salary = min_salary if min_salary is not None else config.MIN_SALARY
    boards = boards or config.ENABLED_BOARDS

    existing_df = _load_existing_jobs()
    all_new_jobs = []
    total_found = 0
    total_filtered = 0
    total_duplicates = 0

    log_list.append({"type": "progress", "message": f"⚡ Starting job search across {len(boards)} boards..."})
    log_list.append({"type": "info", "message": f"📍 Location: {location} | Radius: {radius} mi | Remote: {include_remote}"})
    log_list.append({"type": "info", "message": f"🔎 Searching {len(job_titles)} job titles..."})

    for i, title in enumerate(job_titles):
        log_list.append({"type": "progress", "message": f"⚡ [{i+1}/{len(job_titles)}] Searching: \"{title}\"..."})

        try:
            results = scrape_jobs(
                site_name=boards,
                search_term=title,
                location=location,
                distance=radius,
                is_remote=include_remote,
                results_wanted=results_per_search,
                hours_old=max_days_old * 24,
                country_indeed="USA",
            )

            if results is None or results.empty:
                log_list.append({"type": "info", "message": f"   No results for \"{title}\""})
                continue

            count_before = len(results)
            total_found += count_before

            for _, row in results.iterrows():
                job_title = str(row.get("title", ""))
                job_url = str(row.get("job_url", ""))

                # Apply title filter
                if not _passes_title_filter(job_title):
                    total_filtered += 1
                    continue

                # Check for duplicates
                if _is_duplicate(job_url, existing_df):
                    total_duplicates += 1
                    continue

                # Parse salary
                salary_min = row.get("min_amount", None)
                salary_max = row.get("max_amount", None)
                salary_str = ""
                if pd.notna(salary_min) and pd.notna(salary_max):
                    salary_str = f"${int(salary_min):,} - ${int(salary_max):,}"
                elif pd.notna(salary_min):
                    salary_str = f"${int(salary_min):,}+"
                elif pd.notna(salary_max):
                    salary_str = f"Up to ${int(salary_max):,}"

                # Filter by minimum salary if salary info available
                if min_salary and pd.notna(salary_max) and salary_max < min_salary:
                    total_filtered += 1
                    continue

                # Determine if remote
                is_remote = bool(row.get("is_remote", False))

                # Build job record
                job = {
                    "id": str(uuid.uuid4())[:8],
                    "title": job_title,
                    "company": str(row.get("company", "Unknown")),
                    "location": str(row.get("location", "N/A")),
                    "salary": salary_str,
                    "job_url": job_url,
                    "source": str(row.get("site", "unknown")),
                    "date_posted": str(row.get("date_posted", "")),
                    "description": str(row.get("description", ""))[:5000],
                    "status": "Not Applied",
                    "notes": "",
                    "cover_letter_path": "",
                    "date_added": datetime.now().isoformat(),
                    "is_remote": is_remote,
                }

                all_new_jobs.append(job)

                # Also add to existing_df for dedup within session
                existing_df = pd.concat([existing_df, pd.DataFrame([job])], ignore_index=True)

            log_list.append({
                "type": "success",
                "message": f"   ✅ Found {count_before} results, {len(all_new_jobs)} new jobs so far"
            })

        except Exception as e:
            log_list.append({"type": "error", "message": f"   ❌ Error searching \"{title}\": {str(e)}"})

        # Small delay between searches to be respectful
        time.sleep(1)

    # Save new jobs to CSV
    if all_new_jobs:
        new_df = pd.DataFrame(all_new_jobs)
        try:
            old_df = pd.read_csv(config.JOBS_CSV_PATH)
            combined = pd.concat([old_df, new_df], ignore_index=True)
        except (FileNotFoundError, pd.errors.EmptyDataError):
            combined = new_df
        combined.to_csv(config.JOBS_CSV_PATH, index=False)

    log_list.append({"type": "success", "message": f""})
    log_list.append({"type": "success", "message": f"✅ Search complete!"})
    log_list.append({"type": "info", "message": f"   📊 Total found: {total_found}"})
    log_list.append({"type": "info", "message": f"   🆕 New jobs added: {len(all_new_jobs)}"})
    log_list.append({"type": "info", "message": f"   🔄 Duplicates skipped: {total_duplicates}"})
    log_list.append({"type": "info", "message": f"   🚫 Filtered out: {total_filtered}"})

    return len(all_new_jobs)
