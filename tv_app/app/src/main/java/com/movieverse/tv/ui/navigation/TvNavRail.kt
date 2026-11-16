@file:OptIn(
    androidx.compose.ui.ExperimentalComposeUiApi::class,
    androidx.tv.material3.ExperimentalTvMaterial3Api::class
)

package com.movieverse.tv.ui.navigation

import android.util.Log
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Icon
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.movieverse.tv.ui.theme.TvThemeTokens
import com.movieverse.tv.ui.theme.TvTokens

// ─── Constants ────────────────────────────────────────────────────────────────
private val ITEM_HEIGHT   = 52.dp
private val ICON_SIZE     = 24.dp
private val ICON_COL_W    = TvTokens.NavRailCollapsedWidth  // 68dp
private val EXPANDED_W    = 220.dp
private val PILL_H        = 44.dp
private val PILL_RADIUS   = 22.dp
private val ACCENT_BAR_W  = 3.dp

@Composable
fun TvNavRail(
    currentDestination: TvDestination,
    onDestinationSelected: (TvDestination) -> Unit,
    railFocusRequester: FocusRequester,
    lastFocusedContentRequester: FocusRequester?,
    modifier: Modifier = Modifier
) {
    var railHasFocus by remember { mutableStateOf(false) }

    // Map each destination to its FocusRequester
    val itemFocusRequesters = remember {
        TvDestination.values().associateWith { FocusRequester() }
    }

    val selectedRequester = itemFocusRequesters[currentDestination]
        ?: itemFocusRequesters[TvDestination.Home]
        ?: remember { FocusRequester() }

    val railWidth: Dp by animateDpAsState(
        targetValue = if (railHasFocus) EXPANDED_W else ICON_COL_W,
        animationSpec = tween(durationMillis = 200),
        label = "railWidth"
    )

    Box(
        modifier = modifier
            .fillMaxHeight()
            .focusRequester(railFocusRequester)
            .focusProperties {
                // When focus enters the rail, redirect directly to selected item
                enter = {
                    selectedRequester
                }
            }
            .focusGroup()
            .onFocusChanged {
                railHasFocus = it.hasFocus
            }
    ) {
        // ── Dark scrim gradient when expanded (overlay) ──────────────────
        if (railHasFocus) {
            Box(
                modifier = Modifier
                    .width(EXPANDED_W + 64.dp)
                    .fillMaxHeight()
                    .background(
                        Brush.horizontalGradient(
                            0f to Color(0xF2080810),
                            0.75f to Color(0xAA080810),
                            1f to Color.Transparent
                        )
                    )
            )
        }

        // ── Rail Column ───────────────────────────────────────────────────
        Column(
            modifier = Modifier
                .width(railWidth)
                .fillMaxHeight()
                .padding(vertical = TvThemeTokens.dimensions.verticalSafePadding),
            horizontalAlignment = Alignment.Start
        ) {
            Spacer(modifier = Modifier.height(8.dp))

            TvDestination.values().forEach { dest ->
                val isSelected = dest == currentDestination
                val requester = itemFocusRequesters[dest] ?: remember { FocusRequester() }

                NavRailItem(
                    destination = dest,
                    isSelected = isSelected,
                    isExpanded = railHasFocus,
                    focusRequester = requester,
                    lastFocusedContentRequester = lastFocusedContentRequester,
                    onClick = { onDestinationSelected(dest) }
                )
            }
        }
    }
}

@Composable
private fun NavRailItem(
    destination: TvDestination,
    isSelected: Boolean,
    isExpanded: Boolean,
    focusRequester: FocusRequester,
    lastFocusedContentRequester: FocusRequester?,
    onClick: () -> Unit
) {
    var isFocused by remember { mutableStateOf(false) }

    // Colors per Bug #5:
    // Focused: filled pill (white @ 16%) + white icon + white label
    // Selected (unfocused): accent-colored icon + accent bar on left, NO pill
    // Unfocused/Unselected: 55% white icon + label
    val iconTint = when {
        isFocused  -> Color.White
        isSelected -> TvTokens.Accent
        else       -> Color.White.copy(alpha = 0.55f)
    }
    val labelColor = when {
        isFocused  -> Color.White
        isSelected -> TvTokens.Accent
        else       -> Color.White.copy(alpha = 0.55f)
    }

    Surface(
        onClick = onClick,
        modifier = Modifier
            .height(ITEM_HEIGHT)
            .width(EXPANDED_W)
            .focusRequester(focusRequester)
            .focusProperties {
                // From rail, RIGHT returns focus to the last focused content item
                right = lastFocusedContentRequester ?: FocusRequester.Default
                exit = { direction ->
                    if (direction == FocusDirection.Right || direction == FocusDirection.Next) {
                        lastFocusedContentRequester ?: FocusRequester.Default
                    } else {
                        FocusRequester.Default
                    }
                }
            }
            .onFocusChanged {
                isFocused = it.isFocused
                if (it.isFocused) {
                    Log.d("FOCUS", "Screen: Rail | Item ${destination.title} focused")
                }
            },
        shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(PILL_RADIUS)),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = Color.Transparent,
            focusedContainerColor = Color.White.copy(alpha = 0.16f),
            pressedContainerColor = Color.White.copy(alpha = 0.24f)
        )
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .then(
                    if (isFocused) Modifier.border(
                        width = 3.dp,
                        color = Color.White,
                        shape = RoundedCornerShape(PILL_RADIUS)
                    ) else Modifier
                ),
            contentAlignment = Alignment.CenterStart
        ) {
            // Accent bar on left edge for selected (unfocused)
            if (isSelected && !isFocused) {
                Box(
                    modifier = Modifier
                        .width(ACCENT_BAR_W)
                        .height(24.dp)
                        .clip(RoundedCornerShape(topEnd = 2.dp, bottomEnd = 2.dp))
                        .background(TvTokens.Accent)
                        .align(Alignment.CenterStart)
                )
            }

            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(start = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Fixed icon column (48dp centered inside 68dp collapsed rail)
                Box(
                    modifier = Modifier.size(ICON_COL_W - 20.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = destination.icon,
                        contentDescription = destination.title,
                        modifier = Modifier.size(ICON_SIZE),
                        tint = iconTint
                    )
                }

                // Label shown only when rail is expanded
                if (isExpanded) {
                    Text(
                        text = destination.title,
                        color = labelColor,
                        fontSize = 15.sp,
                        fontWeight = if (isFocused || isSelected) FontWeight.SemiBold else FontWeight.Normal,
                        maxLines = 1
                    )
                }
            }
        }
    }
}
