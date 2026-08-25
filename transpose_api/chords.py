from __future__ import annotations

import re


SHARP_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
FLAT_NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
FLAT_TO_SHARP = {
    "Db": "C#",
    "Eb": "D#",
    "Gb": "F#",
    "Ab": "G#",
    "Bb": "A#",
    "Cb": "B",
    "Fb": "E",
    "E#": "F",
    "B#": "C",
}

MAX_CHORD_CORE_LENGTH = 32
MAX_CHORD_TOKEN_LENGTH = 64

_ACCIDENTAL_RE = r"[#b♯♭]"
_NOTE_RE = rf"[A-G](?:{_ACCIDENTAL_RE})?"
_DEGREE_RE = r"(?:13|11|9|7|6|5|4|3|2)"
_EXTENSION_RE = r"(?:6[/⁄∕]9|69|13|11|9|7|6|5|4|2)"
_MINOR_MAJOR_QUALITY_RE = r"(?:m(?i:maj)|(?i:minmaj)|mM|m[Δ∆△])"
_WORD_QUALITY_RE = r"(?i:maj|min|mi|ma|dim|aug|dom)"
_SYMBOL_QUALITY_RE = r"(?:m|M|Δ|∆|△|°|º|[Øø]|\+|-|−)"
_QUALITY_RE = rf"(?:{_MINOR_MAJOR_QUALITY_RE}|{_WORD_QUALITY_RE}|{_SYMBOL_QUALITY_RE})"
_SUSPENSION_RE = r"(?i:sus)(?:2|4)?"
_ADDED_TONE_RE = rf"(?i:add)(?:{_ACCIDENTAL_RE})?{_DEGREE_RE}"
_OMITTED_TONE_RE = rf"(?i:no|omit){_DEGREE_RE}"
_ALTERATION_RE = rf"{_ACCIDENTAL_RE}{_DEGREE_RE}"
_SIGNED_ALTERATION_RE = r"(?:\+|-|−)(?:13|11|9|5)"
_ALT_RE = r"(?i:alt)"
_PAREN_QUALITY_RE = rf"{_QUALITY_RE}(?:{_EXTENSION_RE})?"
_PAREN_ITEM_RE = (
    rf"(?:{_ALTERATION_RE}|{_SIGNED_ALTERATION_RE}|{_DEGREE_RE}|{_ADDED_TONE_RE}|"
    rf"{_OMITTED_TONE_RE}|{_SUSPENSION_RE}|{_PAREN_QUALITY_RE}|{_ALT_RE})"
)
_PAREN_MODIFIERS_RE = (
    rf"\({_PAREN_ITEM_RE}(?:(?:[,;/]{_PAREN_ITEM_RE})|{_ALTERATION_RE}|{_SIGNED_ALTERATION_RE})*\)"
)
_TRAILING_MODIFIER_RE = (
    rf"(?:{_ADDED_TONE_RE}|{_OMITTED_TONE_RE}|{_ALTERATION_RE}|"
    rf"{_SIGNED_ALTERATION_RE}|{_PAREN_MODIFIERS_RE})"
)
_SUFFIX_RE = (
    rf"(?:{_QUALITY_RE})?(?:{_EXTENSION_RE})?(?:{_SUSPENSION_RE})?"
    rf"(?:{_TRAILING_MODIFIER_RE})*(?:{_ALT_RE})?"
)

CHORD_CORE_RE = re.compile(
    rf"^({_NOTE_RE})({_SUFFIX_RE})(?:[/⁄∕]({_NOTE_RE}{_SUFFIX_RE}))?$"
)
LEADING_WRAPPER_CHARS = "[({|\\/:;,_-–—•·"
TRAILING_WRAPPER_CHARS = "])}|/\\:;,_-–—•·"
TRAILING_REPEAT_RE = re.compile(r"(?i)((?:\s*[x×]\s*\d+)+)$")


def normalize_note(note: str) -> str:
    """Convert enharmonic flat spellings to their sharp equivalent."""

    ascii_note = note.replace("♯", "#").replace("♭", "b")
    return FLAT_TO_SHARP.get(ascii_note, ascii_note)


def transpose_note(note: str, semitones: int) -> str:
    """Transpose a note up/down, preferring sharps when ascending and flats when descending."""

    if semitones == 0:
        return note
    normalized = normalize_note(note)
    index = SHARP_NOTES.index(normalized)
    notes = FLAT_NOTES if semitones < 0 else SHARP_NOTES
    return notes[(index + semitones) % len(notes)]


def _match_chord_core(value: str) -> re.Match[str] | None:
    if not value or len(value) > MAX_CHORD_CORE_LENGTH:
        return None
    return CHORD_CORE_RE.fullmatch(value)


def _wrapper_run_length(text: str, characters: str, *, from_start: bool) -> int:
    iterable = text if from_start else reversed(text)
    count = 0
    for character in iterable:
        if character not in characters:
            break
        count += 1
    return count


def _split_token_shell(token: str) -> tuple[str, str, str]:
    text = token.strip()
    if not text or len(text) > MAX_CHORD_TOKEN_LENGTH:
        return "", "", ""

    if _match_chord_core(text):
        return "", text, ""

    repeat_match = TRAILING_REPEAT_RE.search(text)
    repeat_suffix = repeat_match.group(1) if repeat_match else ""
    without_repeat = text[:-len(repeat_suffix)] if repeat_suffix else text
    if _match_chord_core(without_repeat):
        return "", without_repeat, repeat_suffix

    leading_count = _wrapper_run_length(without_repeat, LEADING_WRAPPER_CHARS, from_start=True)
    trailing_count = _wrapper_run_length(without_repeat, TRAILING_WRAPPER_CHARS, from_start=False)
    for removed_total in range(1, leading_count + trailing_count + 1):
        for prefix_length in range(0, min(leading_count, removed_total) + 1):
            suffix_length = removed_total - prefix_length
            if suffix_length > trailing_count:
                continue
            end = len(without_repeat) - suffix_length if suffix_length else len(without_repeat)
            if prefix_length >= end:
                continue
            core = without_repeat[prefix_length:end].strip()
            if not _match_chord_core(core):
                continue
            prefix = without_repeat[:prefix_length]
            suffix = without_repeat[end:]
            return prefix, core, f"{suffix}{repeat_suffix}"

    return "", without_repeat.strip(), repeat_suffix


def transpose_chord_token(token: str, semitones: int) -> str:
    prefix, core, suffix = _split_token_shell(token)
    match = _match_chord_core(core)
    if not match:
        return token
    root, chord_suffix, bass = match.groups()
    transposed_root = transpose_note(root, semitones)
    transposed = f"{transposed_root}{chord_suffix}"
    if bass:
        bass_match = _match_chord_core(bass)
        if bass_match:
            bass_root, bass_suffix, _ = bass_match.groups()
            transposed_bass = f"{transpose_note(bass_root, semitones)}{bass_suffix}"
        else:
            transposed_bass = transpose_note(bass, semitones)
        transposed = f"{transposed}/{transposed_bass}"
    return f"{prefix}{transposed}{suffix}"


def is_probable_chord_token(token: str) -> bool:
    _prefix, core, _suffix = _split_token_shell(token)
    if not core:
        return False
    return _match_chord_core(core) is not None
