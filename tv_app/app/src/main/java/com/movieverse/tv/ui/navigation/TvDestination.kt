package com.movieverse.tv.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Tv
import androidx.compose.ui.graphics.vector.ImageVector

enum class TvDestination(
    val route: String,
    val title: String,
    val icon: ImageVector
) {
    Search("search", "Search", Icons.Default.Search),
    Home("home", "Home", Icons.Default.Home),
    Movies("movies", "Movies", Icons.Default.Movie),
    Shows("shows", "TV Shows", Icons.Default.Tv),
    MyList("my_list", "My List", Icons.Default.Bookmark),
    Settings("settings", "Settings", Icons.Default.Settings);

    companion object {
        val rootDestinations = listOf(Search, Home, Movies, Shows, MyList, Settings)
    }
}
