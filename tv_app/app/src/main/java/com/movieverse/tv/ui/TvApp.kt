@file:OptIn(androidx.tv.material3.ExperimentalTvMaterial3Api::class)

package com.movieverse.tv.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.movieverse.tv.ui.navigation.TvDestination
import com.movieverse.tv.ui.navigation.TvNavRail
import com.movieverse.tv.ui.screens.HomeScreen
import com.movieverse.tv.ui.screens.SimplePlaceholderScreen
import com.movieverse.tv.ui.theme.TvTokens

// Content left offset = collapsed rail width (68dp) + 24dp gap = 92dp
// Content never relayouts when rail expands.
private val CONTENT_LEFT_OFFSET = TvTokens.NavRailCollapsedWidth + 24.dp

@Composable
fun TvApp(
    navController: NavHostController = rememberNavController()
) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route ?: TvDestination.Home.route

    val currentDestination = remember(currentRoute) {
        TvDestination.values().firstOrNull { it.route == currentRoute } ?: TvDestination.Home
    }

    BackHandler(enabled = currentDestination != TvDestination.Home) {
        navController.navigate(TvDestination.Home.route) {
            popUpTo(TvDestination.Home.route) { inclusive = false }
            launchSingleTop = true
        }
    }

    // Two-way focus coordination between Content and Rail
    val railFocusRequester = remember { FocusRequester() }
    var lastFocusedContentRequester by remember { mutableStateOf<FocusRequester?>(null) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(TvTokens.Background)
    ) {
        // ── Content layer: fixed left padding = 92dp ──────────────────────
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(start = CONTENT_LEFT_OFFSET)
        ) {
            NavHost(
                navController = navController,
                startDestination = TvDestination.Home.route,
                modifier = Modifier.fillMaxSize()
            ) {
                composable(TvDestination.Home.route) {
                    HomeScreen(
                        railFocusRequester = railFocusRequester,
                        onContentFocused = { requester ->
                            lastFocusedContentRequester = requester
                        }
                    )
                }
                composable(TvDestination.Movies.route) {
                    SimplePlaceholderScreen("Movies", "Curated cinema catalog — coming in Step 2")
                }
                composable(TvDestination.Shows.route) {
                    SimplePlaceholderScreen("TV Shows", "Full seasons & episodes — coming in Step 2")
                }
                composable(TvDestination.Search.route) {
                    SimplePlaceholderScreen("Search", "On-screen TV keyboard — coming in Step 6")
                }
                composable(TvDestination.MyList.route) {
                    SimplePlaceholderScreen("My List", "Bookmarks & Continue Watching — coming in Step 7")
                }
                composable(TvDestination.Settings.route) {
                    SimplePlaceholderScreen("Settings", "App settings & server selection")
                }
            }
        }

        // ── Rail layer: drawn on top, expands over content with dark scrim ─
        TvNavRail(
            currentDestination = currentDestination,
            onDestinationSelected = { dest ->
                if (dest.route != currentRoute) {
                    navController.navigate(dest.route) {
                        popUpTo(TvDestination.Home.route) { saveState = true }
                        launchSingleTop = true
                        restoreState = true
                    }
                }
            },
            railFocusRequester = railFocusRequester,
            lastFocusedContentRequester = lastFocusedContentRequester
        )
    }
}
