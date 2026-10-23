package com.rickphobia.ricknotes.imports

import org.junit.Assert.assertEquals
import org.junit.Test

class ShareRouteTest {
    private val everyFileThere = { _: String -> true }

    @Test
    fun `a shared PDF goes to a folder picker at the last Document's folder`() {
        val route = shareRoute(ShareKind.PDF, listOf("Y1/Sem1/EE2001/tuto3.pdf", "a.pdf"), everyFileThere)

        assertEquals(ShareRoute.ChooseFolder("Y1/Sem1/EE2001"), route)
    }

    @Test
    fun `a shared image opens the last Document`() {
        val route = shareRoute(ShareKind.IMAGE, listOf("Y1/notes.pdf", "a.pdf"), everyFileThere)

        assertEquals(ShareRoute.OpenDocument("Y1/notes.pdf"), route)
    }

    @Test
    fun `with no Document ever opened an image goes to choosing one and a PDF starts at the top`() {
        assertEquals(ShareRoute.ChooseDocument, shareRoute(ShareKind.IMAGE, emptyList(), everyFileThere))
        assertEquals(ShareRoute.ChooseFolder(""), shareRoute(ShareKind.PDF, emptyList(), everyFileThere))
    }

    @Test
    fun `a last Document that was moved away is skipped for the one before it`() {
        val route = shareRoute(ShareKind.IMAGE, listOf("gone.pdf", "Y2/here.pdf")) { it == "Y2/here.pdf" }

        assertEquals(ShareRoute.OpenDocument("Y2/here.pdf"), route)
    }

    @Test
    fun `anything other than an image or a PDF is refused`() {
        assertEquals(ShareRoute.Refuse, shareRoute(ShareKind.OTHER, listOf("a.pdf"), everyFileThere))
    }

    @Test
    fun `a share's type says what kind it is`() {
        assertEquals(ShareKind.PDF, shareKindOf("application/pdf"))
        assertEquals(ShareKind.IMAGE, shareKindOf("image/png"))
        assertEquals(ShareKind.IMAGE, shareKindOf("image/jpeg"))
        assertEquals(ShareKind.IMAGE, shareKindOf("image/webp"))
        assertEquals(ShareKind.OTHER, shareKindOf("text/plain"))
        assertEquals(ShareKind.OTHER, shareKindOf(null))
    }
}
