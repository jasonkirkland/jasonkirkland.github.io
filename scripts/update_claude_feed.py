#!/usr/bin/env python3
"""
update_claude_feed.py

Fetches The Verge's RSS feed, filters for Anthropic/Claude-related items,
and writes/updates the curated anthropic-claude-feed.xml in the repo root.

Dependencies: Python 3.8+ stdlib only (urllib, xml.etree.ElementTree, datetime)
"""

import os
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SOURCE_FEED_URL = "https://www.theverge.com/rss/index.xml"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
OUTPUT_FEED_PATH = os.path.join(REPO_ROOT, "anthropic-claude-feed.xml")

OUTPUT_FEED_URL = "https://jasonkirkland.github.io/anthropic-claude-feed.xml"

# Filter: include item if any keyword appears in title or description (case-insensitive)
FILTER_KEYWORDS = ["claude", "anthropic"]

REQUEST_TIMEOUT = 30

USER_AGENT = (
    "github-actions/rss-monitor "
    "(https://github.com/jasonkirkland/jasonkirkland.github.io)"
)


# ---------------------------------------------------------------------------
# Initial feed template (used when output file doesn't exist yet)
# ---------------------------------------------------------------------------

INITIAL_FEED_TEMPLATE = """\
<?xml version='1.0' encoding='UTF-8'?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Anthropic / Claude News (via The Verge)</title>
    <link>https://www.theverge.com</link>
    <description>Filtered Verge articles about Anthropic and Claude</description>
    <language>en-us</language>
    <atom:link href="{feed_url}" rel="self" type="application/rss+xml"/>
    <lastBuildDate>{build_date}</lastBuildDate>
  </channel>
</rss>
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def rfc822_now() -> str:
    """Return the current UTC time in RFC 822 format."""
    return datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")


def matches_filter(title: str, description: str) -> bool:
    """Return True if the item mentions any of the filter keywords."""
    combined = (title + " " + description).lower()
    return any(kw in combined for kw in FILTER_KEYWORDS)


def fetch_source_feed(url: str) -> ET.Element:
    """Fetch the source RSS feed and return its root XML element."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as response:
            tree = ET.parse(response)
            return tree.getroot()
    except urllib.error.URLError as exc:
        print(f"ERROR: Could not fetch source feed: {exc}", file=sys.stderr)
        sys.exit(1)
    except ET.ParseError as exc:
        print(f"ERROR: Could not parse source feed XML: {exc}", file=sys.stderr)
        sys.exit(1)


def load_or_create_output_feed(path: str) -> ET.ElementTree:
    """Load the existing output feed, or create a fresh one from the template."""
    if os.path.exists(path) and os.path.getsize(path) > 0:
        try:
            return ET.parse(path)
        except ET.ParseError as exc:
            print(f"WARNING: Output feed is malformed ({exc}), recreating it.", file=sys.stderr)

    xml_str = INITIAL_FEED_TEMPLATE.format(
        feed_url=OUTPUT_FEED_URL,
        build_date=rfc822_now(),
    )
    return ET.ElementTree(ET.fromstring(xml_str))


def get_existing_guids(output_tree: ET.ElementTree) -> set:
    """Collect all deduplication keys already in the output feed."""
    guids = set()
    for item in output_tree.getroot().findall("./channel/item"):
        guid_el = item.find("guid")
        link_el = item.find("link")
        key = (guid_el.text if guid_el is not None else None) or \
              (link_el.text if link_el is not None else None)
        if key:
            guids.add(key.strip())
    return guids


def item_dedup_key(item: ET.Element) -> str | None:
    """Return the deduplication key (guid or link) for a source item."""
    guid_el = item.find("guid")
    link_el = item.find("link")
    key = (guid_el.text if guid_el is not None else None) or \
          (link_el.text if link_el is not None else None)
    return key.strip() if key else None


def item_text(item: ET.Element, tag: str) -> str:
    """Safely get text from a child element."""
    el = item.find(tag)
    return (el.text or "").strip() if el is not None else ""


def build_output_item(source_item: ET.Element) -> ET.Element:
    """Build a clean <item> element for the output feed."""
    new_item = ET.Element("item")
    for tag in ("title", "link", "description", "pubDate", "guid"):
        src_el = source_item.find(tag)
        if src_el is not None and src_el.text:
            child = ET.SubElement(new_item, tag)
            child.text = src_el.text.strip()
            if tag == "guid" and src_el.get("isPermaLink"):
                child.set("isPermaLink", src_el.get("isPermaLink"))
    return new_item


def write_output_feed(output_tree: ET.ElementTree, path: str) -> None:
    """Write the output feed to disk, updating lastBuildDate."""
    root = output_tree.getroot()
    channel = root.find("channel")
    if channel is not None:
        lbd = channel.find("lastBuildDate")
        if lbd is None:
            lbd = ET.SubElement(channel, "lastBuildDate")
        lbd.text = rfc822_now()

    if hasattr(ET, "indent"):  # Python 3.9+
        ET.indent(output_tree, space="  ")

    output_tree.write(path, encoding="unicode", xml_declaration=True)

    # Normalize the XML declaration to UTF-8
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    decl_end = content.find("?>")
    if decl_end != -1 and content.startswith("<?xml"):
        content = "<?xml version='1.0' encoding='UTF-8'?>" + content[decl_end + 2:]
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print(f"Fetching source feed: {SOURCE_FEED_URL}")
    source_root = fetch_source_feed(SOURCE_FEED_URL)

    source_items = source_root.findall("./channel/item")
    print(f"Source feed contains {len(source_items)} items.")

    # Filter for Anthropic/Claude content
    filtered = [
        item for item in source_items
        if matches_filter(item_text(item, "title"), item_text(item, "description"))
    ]
    print(f"Matched {len(filtered)} item(s) after filtering.")

    output_tree = load_or_create_output_feed(OUTPUT_FEED_PATH)
    existing_guids = get_existing_guids(output_tree)
    print(f"Output feed already contains {len(existing_guids)} item(s).")

    new_items = [
        item for item in filtered
        if (key := item_dedup_key(item)) and key not in existing_guids
    ]
    print(f"{len(new_items)} new item(s) to add.")

    if not new_items:
        print("No new items. Output feed is up to date.")
        return

    channel = output_tree.getroot().find("channel")
    if channel is None:
        print("ERROR: Output feed is missing <channel> element.", file=sys.stderr)
        sys.exit(1)

    # Find insertion point: before the first existing <item>
    children = list(channel)
    first_item_idx = next(
        (i for i, child in enumerate(children) if child.tag == "item"),
        len(children)
    )

    for offset, source_item in enumerate(new_items):
        channel.insert(first_item_idx + offset, build_output_item(source_item))
        print(f"  + {item_text(source_item, 'title')!r}")

    write_output_feed(output_tree, OUTPUT_FEED_PATH)
    print(f"Feed written to: {OUTPUT_FEED_PATH}")


if __name__ == "__main__":
    main()
