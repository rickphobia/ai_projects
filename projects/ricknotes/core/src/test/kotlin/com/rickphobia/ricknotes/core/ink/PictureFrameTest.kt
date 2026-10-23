package com.rickphobia.ricknotes.core.ink

import org.junit.Assert.assertEquals
import org.junit.Test

class PictureFrameTest {
    @Test
    fun `a wide screenshot fits half the page's width, keeps its shape and is centred where it was dropped`() {
        val frame = fitPicture(2000, 1000, PagePoint(300f, 400f), pageWidthPt = 600f, pageHeightPt = 800f)

        assertEquals(PictureFrame(left = 150f, top = 325f, widthPt = 300f, heightPt = 150f), frame)
    }

    @Test
    fun `a tall image fits half the page's height`() {
        val frame = fitPicture(500, 4000, PagePoint(300f, 400f), pageWidthPt = 600f, pageHeightPt = 800f)

        assertEquals(400f, frame.heightPt)
        assertEquals(50f, frame.widthPt)
    }

    @Test
    fun `a small image is not blown up past one pixel per point`() {
        val frame = fitPicture(100, 50, PagePoint(300f, 400f), pageWidthPt = 600f, pageHeightPt = 800f)

        assertEquals(100f, frame.widthPt)
        assertEquals(50f, frame.heightPt)
    }

    @Test
    fun `an image dropped near an edge is moved in so it is wholly on the page`() {
        val corner = fitPicture(2000, 1000, PagePoint(590f, 795f), pageWidthPt = 600f, pageHeightPt = 800f)
        val otherCorner = fitPicture(2000, 1000, PagePoint(-20f, 0f), pageWidthPt = 600f, pageHeightPt = 800f)

        assertEquals(PictureFrame(left = 300f, top = 650f, widthPt = 300f, heightPt = 150f), corner)
        assertEquals(PictureFrame(left = 0f, top = 0f, widthPt = 300f, heightPt = 150f), otherCorner)
    }
}
