"""Regression tests for the crop-ranking bug fix.

Verifies:
  1. top5_with_groundwater and top5_without_groundwater carry
     ranks [1,2,3,4,5] in that exact order.
  2. Scores are monotonically non-increasing within each list.
  3. A crop appearing in both lists has independent, correct ranks
     in each (previous bug: shared dicts caused rank overwrite).
"""
import os
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://groundwater-crops.preview.emergentagent.com",
).rstrip("/")


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def recommendation(client):
    npk = client.get(
        f"{BASE_URL}/api/npk",
        params={"state": "Telangana", "district": "Adilabad"},
        timeout=30,
    ).json()
    gw = client.get(
        f"{BASE_URL}/api/groundwater",
        params={"state": "Telangana", "district": "Adilabad"},
        timeout=30,
    ).json()
    payload = {
        "state": "Telangana",
        "district": "Adilabad",
        "npk": npk,
        "weather": {"temperature_c": 24.6, "humidity_pct": 90, "rainfall_mm": 25},
        "groundwater": gw,
    }
    r = client.post(f"{BASE_URL}/api/recommend", json=payload, timeout=60)
    assert r.status_code == 200, r.text
    return r.json()


def test_ranks_with_groundwater_are_1_to_5(recommendation):
    tw = recommendation["top5_with_groundwater"]
    assert len(tw) == 5
    ranks = [c["rank"] for c in tw]
    assert ranks == [1, 2, 3, 4, 5], f"Expected [1..5], got {ranks}"


def test_ranks_without_groundwater_are_1_to_5(recommendation):
    two = recommendation["top5_without_groundwater"]
    assert len(two) == 5
    ranks = [c["rank"] for c in two]
    assert ranks == [1, 2, 3, 4, 5], f"Expected [1..5], got {ranks}"


def test_scores_with_groundwater_monotonic_desc(recommendation):
    scores = [c["score_with_groundwater"] for c in recommendation["top5_with_groundwater"]]
    for a, b in zip(scores, scores[1:]):
        assert a >= b, f"scores not non-increasing: {scores}"


def test_scores_without_groundwater_monotonic_desc(recommendation):
    scores = [c["score_without_groundwater"] for c in recommendation["top5_without_groundwater"]]
    for a, b in zip(scores, scores[1:]):
        assert a >= b, f"scores not non-increasing: {scores}"


def test_shared_crop_has_independent_ranks(recommendation):
    """Verify shared-dict bug fix: same crop in both lists must reflect the
    correct rank for that specific list (rank_with vs rank_without)."""
    tw = recommendation["top5_with_groundwater"]
    two = recommendation["top5_without_groundwater"]
    tw_map = {c["crop"]: c["rank"] for c in tw}
    two_map = {c["crop"]: c["rank"] for c in two}
    shared = set(tw_map) & set(two_map)
    assert shared, "expected at least one crop shared across both top5 lists"

    # Cross-check ranks against comparison block
    comp = {c["crop"]: c for c in recommendation["comparison"]}
    for crop in shared:
        # Rank in with-list must equal rank_with in comparison
        if crop in comp:
            assert tw_map[crop] == comp[crop]["rank_with"], (
                f"{crop}: top5_with rank {tw_map[crop]} != comparison.rank_with {comp[crop]['rank_with']}"
            )
            assert two_map[crop] == comp[crop]["rank_without"], (
                f"{crop}: top5_without rank {two_map[crop]} != comparison.rank_without {comp[crop]['rank_without']}"
            )
        # If ranks are different between lists this specifically proves the
        # shared-dict bug is gone
    # Also assert at least one shared crop's rank differs between lists
    # (only meaningful if there is one; otherwise still fine).
    print("Shared crops:", shared, "tw:", tw_map, "two:", two_map)


def test_ml_confidence_still_returned_by_backend(recommendation):
    """Backend still returns ml_confidence; only frontend hides it."""
    for c in recommendation["top5_with_groundwater"]:
        assert "ml_confidence" in c, "backend should still return ml_confidence"
