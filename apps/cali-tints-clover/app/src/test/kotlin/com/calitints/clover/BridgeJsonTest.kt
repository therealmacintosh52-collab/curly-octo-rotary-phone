package com.calitints.clover

import org.junit.Assert.assertEquals
import org.junit.Test

class BridgeJsonTest {
    @Test
    fun escapesStringsForJavaScript() {
        assertEquals("\"plain\"", BridgeJson.str("plain"))
        assertEquals("\"a\\\"b\\\\c\\nd\"", BridgeJson.str("a\"b\\c\nd"))
        assertEquals("\"\\u003C/script>\"", BridgeJson.str("</script>"))
        assertEquals("\"\\u2028\"", BridgeJson.str("\u2028"))
        assertEquals("null", BridgeJson.str(null))
    }

    @Test
    fun buildsObjects() {
        assertEquals("{\"ok\":true,\"text\":\"W1KZF8DB5NA123456\"}", BridgeJson.scanOk("W1KZF8DB5NA123456"))
        assertEquals("{\"ok\":false,\"error\":\"Timed out\",\"code\":\"timeout\"}", BridgeJson.scanError("Timed out", "timeout"))
        assertEquals(
            "{\"app\":\"cali-tints-clover\",\"version\":\"1.0.0\",\"device\":\"C403\",\"clover\":true,\"camera\":false}",
            BridgeJson.info("1.0.0", "C403", clover = true, cameraGranted = false),
        )
        assertEquals("{\"n\":3,\"x\":null}", BridgeJson.obj("n" to 3, "x" to null))
        assertEquals("{\"ok\":true,\"paymentId\":\"P1\",\"amountCents\":20000,\"tender\":\"Credit Card\",\"last4\":\"4242\"}", BridgeJson.payOk("P1", 20000L, "Credit Card", "4242"))
        assertEquals("{\"ok\":false,\"error\":\"Payment cancelled\",\"code\":\"cancelled\"}", BridgeJson.payError("Payment cancelled", "cancelled"))
    }
}
