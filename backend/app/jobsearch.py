import asyncio
import re
import unicodedata
from datetime import datetime, timedelta
from typing import Optional

import httpx
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from .config import settings
from .database import session_scope
from .models import Company, JobListing, SearchCache, SearchHistory

GUPY_JOBS_API = "https://employability-portal.gupy.io/api/v1/jobs"
INHIRE_JOBS_API = "https://api.inhire.app/job-posts/public/pages"
INHIRE_HEADERS = {
    "X-Inhire-Client": "web-inhire",
    "Content-Type": "application/json",
    "Accept": "application/json",
}

_GUPY_PAGE_LIMIT = 100
_GUPY_MAX_OFFSET = 3000
_SEARCH_CONCURRENCY = 8

_STOP_TOKENS = {
    "sa", "s", "a", "ltda", "me", "eireli", "group", "grupo", "the", "company", "co",
    "tecnologia", "tech", "brasil", "brazil", "do", "de", "da", "dos", "das", "and",
    "solutions", "software", "digital", "inc", "holding", "participacoes", "banco",
}


def _strip_accents(text: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn"
    )


def normalize(text: str) -> str:
    t = _strip_accents(str(text)).lower()
    t = re.sub(r"[^a-z0-9]+", " ", t)
    return t.strip()


def compact(text: str) -> str:
    t = _strip_accents(str(text)).lower().replace("&", " e ")
    return re.sub(r"[^a-z0-9]+", "", t)


def tokens(text: str) -> list[str]:
    t = _strip_accents(str(text)).lower()
    t = re.sub(r"[^a-z0-9]+", " ", t)
    return [tok for tok in t.split() if tok and tok not in _STOP_TOKENS]


def slugify(text: str) -> str:
    t = _strip_accents(str(text)).lower().replace("&", " and ")
    t = re.sub(r"[^a-z0-9]+", "-", t).strip("-")
    return t or "vaga"


def term_match(title: str, terms: list[str]) -> bool:
    padded_title = f" {normalize(title)} "
    for term in terms:
        norm_term = normalize(term)
        if norm_term and f" {norm_term} " in padded_title:
            return True
    return False


def gupy_career_page_matches(company_name: str, career_page_name: str) -> bool:
    """Attributing a job from Gupy's global search to a company needs to be strict:
    career pages are full of generic call-to-action prefixes ("Vem ser...", "Vem pra...")
    that share short tokens with unrelated company names. Exact or substring match on the
    compacted name only (mirrors the reference repo's Gupy matchCompany, no token overlap)."""
    ca, cb = compact(company_name), compact(career_page_name)
    if not ca or not cb:
        return False
    if ca == cb:
        return True
    return (len(ca) >= 5 and ca in cb) or (len(cb) >= 5 and cb in ca)


def name_matches(company_name: str, other_name: str) -> bool:
    a, b = set(tokens(company_name)), set(tokens(other_name))
    if not a or not b:
        return compact(company_name) == compact(other_name)
    if any(tok in b and len(tok) >= 3 for tok in a):
        return True
    ca, cb = compact(company_name), compact(other_name)
    return (len(ca) >= 5 and ca in cb) or (len(cb) >= 5 and cb in ca)


def slug_variants(name: str) -> list[str]:
    all_toks = re.sub(r"[^a-z0-9]+", " ", _strip_accents(name).lower()).split()
    toks = tokens(name)
    candidates = [
        compact(name),
        "".join(all_toks),
        "".join(toks),
        "-".join(all_toks),
        "-".join(toks),
        all_toks[0] if all_toks else "",
        toks[0] if toks else "",
    ]
    seen, variants = set(), []
    for c in candidates:
        if c and 2 <= len(c) <= 40 and c not in seen:
            seen.add(c)
            variants.append(c)
    return variants


def terms_signature(terms: list[str]) -> str:
    normalized = sorted({normalize(t) for t in terms if normalize(t)})
    return ",".join(normalized)


async def _fetch_gupy_page(client: httpx.AsyncClient, term: str, offset: int, limit: int) -> dict:
    res = await client.get(
        GUPY_JOBS_API,
        params={"jobName": term, "offset": offset, "limit": limit},
        headers={"Accept": "application/json"},
    )
    res.raise_for_status()
    return res.json()


async def search_gupy_term(term: str) -> list[dict]:
    out: list[dict] = []
    offset = 0
    async with httpx.AsyncClient(timeout=15) as client:
        while offset <= _GUPY_MAX_OFFSET:
            data = None
            for attempt in range(3):
                try:
                    data = await _fetch_gupy_page(client, term, offset, _GUPY_PAGE_LIMIT)
                    break
                except (httpx.HTTPError,) as exc:
                    if attempt == 2:
                        raise exc
                    await asyncio.sleep(0.8)
            jobs = (data or {}).get("data") or []
            out.extend(jobs)
            if len(jobs) < _GUPY_PAGE_LIMIT:
                break
            offset += _GUPY_PAGE_LIMIT
            await asyncio.sleep(0.12)
    return out


async def search_inhire_tenant(slug: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.get(INHIRE_JOBS_API, headers={**INHIRE_HEADERS, "X-Tenant": slug})
        if res.status_code != 200:
            return []
        data = res.json()
        if isinstance(data, list):
            return []
        return data.get("jobsPage") or []


async def probe_gupy_presence(company_name: str) -> Optional[str]:
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        for slug in slug_variants(company_name):
            try:
                res = await client.get(f"https://{slug}.gupy.io/")
            except httpx.HTTPError:
                continue
            if res.status_code != 200:
                continue
            match = re.search(r"<title>([^<]*)</title>", res.text, re.IGNORECASE)
            title = match.group(1).strip() if match else ""
            if title and title != "404" and name_matches(company_name, title):
                return slug
    return None


async def probe_inhire_presence(company_name: str) -> Optional[str]:
    async with httpx.AsyncClient(timeout=10) as client:
        for slug in slug_variants(company_name):
            try:
                res = await client.get(INHIRE_JOBS_API, headers={**INHIRE_HEADERS, "X-Tenant": slug})
            except httpx.HTTPError:
                continue
            if res.status_code != 200:
                continue
            data = res.json()
            if isinstance(data, list):
                continue
            tenant_name = data.get("tenantName") or slug
            if name_matches(company_name, tenant_name):
                return slug
    return None


async def _fetch_gupy_safe(semaphore: asyncio.Semaphore, term: str) -> list[dict]:
    async with semaphore:
        try:
            return await search_gupy_term(term)
        except Exception:
            return []


async def _fetch_inhire_safe(semaphore: asyncio.Semaphore, slug: str) -> list[dict]:
    async with semaphore:
        try:
            return await search_inhire_tenant(slug)
        except Exception:
            return []


async def _get_cache_entry(session, company_id: int, platform: str, signature: str) -> Optional[SearchCache]:
    stmt = select(SearchCache).where(
        SearchCache.company_id == company_id,
        SearchCache.platform == platform,
        SearchCache.terms_signature == signature,
    )
    return (await session.execute(stmt)).scalars().first()


async def _copy_cached_listings(session, search_id: int, company_id: int, platform: str, signature: str, cutoff: datetime) -> bool:
    """Reuses a still-fresh previous fetch (including "fetched, found nothing")
    for this exact company+platform+terms combo, instead of hitting the network again."""
    cache = await _get_cache_entry(session, company_id, platform, signature)
    if not cache or cache.fetched_at < cutoff:
        return False
    stmt = select(JobListing).where(
        JobListing.search_id == cache.last_search_id,
        JobListing.company_id == company_id,
        JobListing.platform == platform,
    )
    rows = (await session.execute(stmt)).scalars().all()
    for row in rows:
        session.add(JobListing(
            search_id=search_id, company_id=row.company_id, platform=row.platform,
            title=row.title, url=row.url, location=row.location,
            workplace_type=row.workplace_type, published_date=row.published_date,
            fetched_at=row.fetched_at,
        ))
    return True


async def _persist_company_result(session, search_id: int, company_id: int, platform: str, signature: str, listings: list[dict]):
    """Writes freshly-fetched listings and marks the cache entry fresh, atomically enough
    to tolerate a rare concurrent-search race on the (company, platform, signature) cache row."""
    now = datetime.now()
    for attempt in range(2):
        for listing in listings:
            session.add(JobListing(**listing))
        cache = await _get_cache_entry(session, company_id, platform, signature)
        if cache:
            cache.last_search_id = search_id
            cache.fetched_at = now
            session.add(cache)
        else:
            session.add(SearchCache(
                company_id=company_id, platform=platform, terms_signature=signature,
                last_search_id=search_id, fetched_at=now,
            ))
        try:
            await session.commit()
            return
        except IntegrityError:
            if attempt == 1:
                raise
            await session.rollback()


async def _bump_progress(session, search_id: int, completed: int):
    history = (await session.execute(select(SearchHistory).where(SearchHistory.id == search_id))).scalars().first()
    history.completed = completed
    session.add(history)
    await session.commit()


async def run_search(search_id: int, terms: list[str], company_ids: list[int]):
    async with session_scope() as session:
        signature = terms_signature(terms)
        cutoff = datetime.now() - timedelta(minutes=settings.job_search_cache_ttl_minutes)
        companies = (await session.execute(select(Company).where(Company.id.in_(company_ids)))).scalars().all()

        pending_gupy: list[Company] = []
        pending_inhire: list[Company] = []
        completed = 0

        for company in companies:
            if await _copy_cached_listings(session, search_id, company.id, "gupy", signature, cutoff):
                completed += 1
            else:
                pending_gupy.append(company)

            if company.inhire_slug:
                if await _copy_cached_listings(session, search_id, company.id, "inhire", signature, cutoff):
                    completed += 1
                else:
                    pending_inhire.append(company)
            # no inhire_slug => no InHire check to perform at all; `total` (computed at
            # kickoff) already excludes this unit of work, so `completed` must too.

        await session.commit()
        await _bump_progress(session, search_id, completed)

        semaphore = asyncio.Semaphore(_SEARCH_CONCURRENCY)

        if pending_gupy:
            term_job_lists = await asyncio.gather(*[_fetch_gupy_safe(semaphore, t) for t in terms])
            seen_ids = set()
            gupy_jobs = []
            for jobs in term_job_lists:
                for j in jobs:
                    jid = j.get("id")
                    if jid in seen_ids:
                        continue
                    seen_ids.add(jid)
                    gupy_jobs.append(j)

            for company in pending_gupy:
                matches = [j for j in gupy_jobs if gupy_career_page_matches(company.name, j.get("careerPageName") or "")]
                listings = [
                    dict(
                        search_id=search_id,
                        company_id=company.id,
                        platform="gupy",
                        title=j.get("name") or "",
                        url=j.get("jobUrl") or j.get("careerPageUrl") or "",
                        location=", ".join(filter(None, [j.get("city"), j.get("state"), j.get("country")])),
                        workplace_type=j.get("workplaceType"),
                        published_date=j.get("publishedDate"),
                    )
                    for j in matches
                ]
                await _persist_company_result(session, search_id, company.id, "gupy", signature, listings)
                completed += 1
                await _bump_progress(session, search_id, completed)

        if pending_inhire:
            inhire_job_lists = await asyncio.gather(*[_fetch_inhire_safe(semaphore, c.inhire_slug) for c in pending_inhire])
            for company, jobs in zip(pending_inhire, inhire_job_lists):
                listings = []
                for j in jobs:
                    title = j.get("displayName") or ""
                    if terms and not term_match(title, terms):
                        continue
                    listings.append(dict(
                        search_id=search_id,
                        company_id=company.id,
                        platform="inhire",
                        title=title,
                        url=f"https://{company.inhire_slug}.inhire.app/vagas/{j.get('jobId')}/{slugify(title)}",
                        location=j.get("location"),
                        workplace_type=j.get("workplaceType"),
                        published_date=None,
                    ))
                await _persist_company_result(session, search_id, company.id, "inhire", signature, listings)
                completed += 1
                await _bump_progress(session, search_id, completed)

        history = (await session.execute(select(SearchHistory).where(SearchHistory.id == search_id))).scalars().first()
        history.status = "done"
        session.add(history)
        await session.commit()
