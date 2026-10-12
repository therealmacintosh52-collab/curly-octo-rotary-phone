package com.calitints.clover

/**
 * Tiny JSON writer for the messages that cross the JavaScript bridge. Plain
 * Kotlin (no org.json) so it runs in JVM unit tests as well as on the device.
 */
object BridgeJson {
    /** A JSON string literal, escaped per RFC 8259. */
    fun str(s: String?): String {
        if (s == null) return "null"
        val sb = StringBuilder(s.length + 2).append('"')
        for (ch in s) {
            when (ch) {
                '"' -> sb.append("\\\"")
                '\\' -> sb.append("\\\\")
                '\n' -> sb.append("\\n")
                '\r' -> sb.append("\\r")
                '\t' -> sb.append("\\t")
                '\b' -> sb.append("\\b")
                '\u000C' -> sb.append("\\f")
                // U+2028/2029 break JavaScript string literals; `</` must not form a closing tag inside a page.
                ' ' -> sb.append("\\u2028")
                ' ' -> sb.append("\\u2029")
                '<' -> sb.append("\\u003C")
                else -> if (ch < ' ') sb.append(String.format("\\u%04x", ch.code)) else sb.append(ch)
            }
        }
        return sb.append('"').toString()
    }

    /** An object from pairs; values may be String, Boolean, Number or null. */
    fun obj(vararg pairs: Pair<String, Any?>): String =
        pairs.joinToString(prefix = "{", postfix = "}", separator = ",") { (k, v) -> "${str(k)}:${value(v)}" }

    private fun value(v: Any?): String = when (v) {
        null -> "null"
        is String -> str(v)
        is Boolean -> v.toString()
        is Number -> v.toString()
        else -> str(v.toString())
    }

    /** Messages the web app understands (see src/lib/native/clover.ts). */
    fun scanOk(text: String): String = obj("ok" to true, "text" to text)
    fun scanError(error: String, code: String = "error"): String = obj("ok" to false, "error" to error, "code" to code)
    fun info(version: String, device: String, clover: Boolean, cameraGranted: Boolean): String =
        obj("app" to "cali-tints-clover", "version" to version, "device" to device, "clover" to clover, "camera" to cameraGranted)
}
