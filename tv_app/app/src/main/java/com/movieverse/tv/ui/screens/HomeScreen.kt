@file:OptIn(
    androidx.compose.ui.ExperimentalComposeUiApi::class,
    androidx.tv.material3.ExperimentalTvMaterial3Api::class
)

package com.movieverse.tv.ui.screens

import android.util.Log
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.foundation.PivotOffsets
import androidx.tv.foundation.lazy.list.TvLazyColumn
import androidx.tv.foundation.lazy.list.TvLazyRow
import androidx.tv.foundation.lazy.list.itemsIndexed
import androidx.tv.foundation.lazy.list.rememberTvLazyListState
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Icon
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.movieverse.tv.ui.theme.TvTokens

// ─── Safe area constants ─────────────────────────────────────────────────────
private val H_SAFE = 48.dp
private val V_SAFE = 27.dp

// ─── @Immutable Model (Performance) ──────────────────────────────────────────
@Immutable
data class MockTitle(
    val id: String,
    val title: String,
    val year: String,
    val genre: String,
    val rating: String,
    val synopsis: String
)

val sampleTrendingTitles = listOf(
    MockTitle("lotr", "The Lord of the Rings: The Rings of Power", "2024", "Fantasy • Drama", "8.5", "An epic drama set thousands of years before J.R.R. Tolkien's The Hobbit, following the rise of Sauron across Middle-earth."),
    MockTitle("got", "Game of Thrones", "2019", "Action • Drama", "9.2", "Nine noble families fight for control over Westeros while an ancient enemy awakens beyond the Wall."),
    MockTitle("bb", "Breaking Bad", "2013", "Crime • Thriller", "9.5", "A chemistry teacher diagnosed with terminal cancer teams up with a former student to manufacture methamphetamine."),
    MockTitle("witcher", "The Witcher", "2023", "Fantasy • Adventure", "8.1", "Geralt of Rivia, a mutated monster hunter, struggles to find his place in a world where people prove more wicked than beasts."),
    MockTitle("st", "Stranger Things", "2024", "Sci-Fi • Horror", "8.7", "When a boy disappears, his friends uncover secret experiments and supernatural forces in Hawkins, Indiana.")
)

val sampleTop10Titles = listOf(
    MockTitle("hotd", "House of the Dragon", "2024", "Fantasy • Drama", "8.4", "The story of House Targaryen set 200 years before Game of Thrones, depicting the war of Targaryen succession."),
    MockTitle("crown", "The Crown", "2023", "Drama • History", "8.6", "A chronicle of the life of Queen Elizabeth II from the 1940s to modern times, exploring the political events of the era."),
    MockTitle("succession", "Succession", "2023", "Drama • Comedy", "8.9", "The Roy family controls one of the largest media conglomerates in the world as their patriarch's health declines."),
    MockTitle("peaky", "Peaky Blinders", "2022", "Crime • Drama", "8.8", "A gangster family epic set in Birmingham, England following WWI, centering on the Shelby family's criminal empire."),
    MockTitle("tlou", "The Last of Us", "2023", "Drama • Sci-Fi", "8.8", "Twenty years after a fungal infection destroys civilization, a hardened smuggler escorts a teenager across America.")
)

val samplePopularTitles = listOf(
    MockTitle("boys", "The Boys", "2024", "Action • Sci-Fi", "8.7", "A team of vigilantes sets out to take down corrupt superheroes who abuse their superpowers."),
    MockTitle("bear", "The Bear", "2024", "Comedy • Drama", "8.6", "A young chef from the fine dining world returns to Chicago to run his family's Italian beef sandwich shop."),
    MockTitle("shogun", "Shōgun", "2024", "Drama • History", "8.7", "Lord Toranaga battles for his life as his enemies on the Council of Regents unite against him in feudal Japan."),
    MockTitle("fallout", "Fallout", "2024", "Action • Sci-Fi", "8.4", "In a future, post-apocalyptic Los Angeles brought about by nuclear decimation, citizens must live in underground bunkers."),
    MockTitle("fargo", "Fargo", "2024", "Crime • Drama", "8.9", "Various chronicles of deception, intrigue and murder in and around frozen Minnesota.")
)

// Neutral background gradients for card items
private val neutralGradients = listOf(
    listOf(Color(0xFF1E2030), Color(0xFF0B0B0B)),
    listOf(Color(0xFF1A1A2E), Color(0xFF0B0B0B)),
    listOf(Color(0xFF1C1C1C), Color(0xFF0B0B0B)),
    listOf(Color(0xFF16213E), Color(0xFF0B0B0B)),
    listOf(Color(0xFF1A1A1A), Color(0xFF0B0B0B))
)

@Composable
fun HomeScreen(
    railFocusRequester: FocusRequester,
    onContentFocused: (FocusRequester) -> Unit
) {
    // Isolated Hero title state (Performance: does NOT recompose rows)
    var currentHeroTitle by remember { mutableStateOf(sampleTrendingTitles[0]) }

    val tvLazyColumnState = rememberTvLazyListState()

    // ══ HOME = ONE TvLazyColumn ═════════════════════════════════════════════
    TvLazyColumn(
        state = tvLazyColumnState,
        modifier = Modifier
            .fillMaxSize()
            .focusRestorer(),
        // Scroll the focused row into the upper third (33%) of the screen
        pivotOffsets = PivotOffsets(parentFraction = 0.33f),
        contentPadding = PaddingValues(bottom = 72.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // ── Item 1: Hero Billboard ──────────────────────────────────────────
        item(key = "hero_billboard", contentType = "Hero") {
            HeroSection(
                title = currentHeroTitle,
                railFocusRequester = railFocusRequester,
                onContentFocused = onContentFocused,
                onPlayClick = { Log.d("FOCUS", "Hero: Play clicked for ${currentHeroTitle.title}") },
                onMoreInfoClick = { Log.d("FOCUS", "Hero: More Info clicked for ${currentHeroTitle.title}") }
            )
        }

        // ── Item 2: Trending Now (Row 0) ────────────────────────────────────
        item(key = "row_trending", contentType = "ContentRow") {
            ContentRow(
                rowIndex = 0,
                rowTitle = "Trending Now",
                items = sampleTrendingTitles,
                isTopTen = false,
                railFocusRequester = railFocusRequester,
                onCardFocused = { title, requester ->
                    currentHeroTitle = title
                    onContentFocused(requester)
                }
            )
        }

        // ── Item 3: Top 10 Today (Row 1) ────────────────────────────────────
        item(key = "row_top10", contentType = "ContentRow") {
            ContentRow(
                rowIndex = 1,
                rowTitle = "Top 10 Today",
                items = sampleTop10Titles,
                isTopTen = true,
                railFocusRequester = railFocusRequester,
                onCardFocused = { title, requester ->
                    currentHeroTitle = title
                    onContentFocused(requester)
                }
            )
        }

        // ── Item 4: Popular Series (Row 2) ──────────────────────────────────
        item(key = "row_popular", contentType = "ContentRow") {
            ContentRow(
                rowIndex = 2,
                rowTitle = "Popular Series",
                items = samplePopularTitles,
                isTopTen = false,
                railFocusRequester = railFocusRequester,
                onCardFocused = { title, requester ->
                    currentHeroTitle = title
                    onContentFocused(requester)
                }
            )
        }
    }
}

// ─── Hero Section (Performance Isolated) ──────────────────────────────────────
@Composable
fun HeroSection(
    title: MockTitle,
    railFocusRequester: FocusRequester,
    onContentFocused: (FocusRequester) -> Unit,
    onPlayClick: () -> Unit,
    onMoreInfoClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val playButtonRequester = remember { FocusRequester() }
    val moreInfoButtonRequester = remember { FocusRequester() }
    val myListButtonRequester = remember { FocusRequester() }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(260.dp) // Max 45% screen height on 540dp TV
    ) {
        // Neutral background gradient crossfade
        AnimatedContent(
            targetState = title.id,
            transitionSpec = { fadeIn(tween(350)) togetherWith fadeOut(tween(350)) },
            label = "heroBg"
        ) { titleId ->
            val gradIdx = titleId.hashCode().mod(neutralGradients.size)
            val gradient = neutralGradients[gradIdx]
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Brush.linearGradient(gradient))
            )
        }

        // Left + bottom scrims
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.horizontalGradient(
                        0f to Color(0xDD0B0B0B),
                        0.55f to Color(0x660B0B0B),
                        1f to Color.Transparent
                    )
                )
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        0f to Color.Transparent,
                        0.7f to Color(0x440B0B0B),
                        1f to TvTokens.Background
                    )
                )
        )

        // Hero Info
        Column(
            modifier = Modifier
                .align(Alignment.CenterStart)
                .fillMaxWidth(0.55f)
                .padding(start = H_SAFE, top = V_SAFE, bottom = 8.dp),
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = title.title,
                color = Color.White,
                fontSize = 26.sp,
                fontWeight = FontWeight.Bold,
                lineHeight = 32.sp,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(6.dp))

            // Metadata row: 1 line, white 80%, accent only on star
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = title.year,
                    color = Color.White.copy(alpha = 0.8f),
                    fontSize = 12.sp,
                    maxLines = 1
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(text = "•", color = Color.White.copy(alpha = 0.4f), fontSize = 12.sp)
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = title.genre,
                    color = Color.White.copy(alpha = 0.8f),
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(text = "•", color = Color.White.copy(alpha = 0.4f), fontSize = 12.sp)
                Spacer(modifier = Modifier.width(6.dp))
                Text(text = "★", color = TvTokens.Accent, fontSize = 12.sp)
                Spacer(modifier = Modifier.width(2.dp))
                Text(
                    text = title.rating,
                    color = Color.White.copy(alpha = 0.8f),
                    fontSize = 12.sp
                )
            }

            Spacer(modifier = Modifier.height(6.dp))

            // Synopsis: maxLines = 2
            Text(
                text = title.synopsis,
                color = Color.White.copy(alpha = 0.65f),
                fontSize = 12.sp,
                lineHeight = 16.sp,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(14.dp))

            // Hero Buttons: Play + More Info + My List in a focusGroup
            Row(
                modifier = Modifier.focusGroup(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                HeroButton(
                    label = "Play",
                    iconVector = Icons.Filled.PlayArrow,
                    focusRequester = playButtonRequester,
                    leftFocusRequester = railFocusRequester, // LEFT from Play enters Nav Rail!
                    onFocused = {
                        Log.d("FOCUS", "Screen: Home | Hero | Play Button focused")
                        onContentFocused(playButtonRequester)
                    },
                    onClick = onPlayClick
                )

                HeroButton(
                    label = "More Info",
                    iconVector = Icons.Filled.Info,
                    focusRequester = moreInfoButtonRequester,
                    leftFocusRequester = null,
                    onFocused = {
                        Log.d("FOCUS", "Screen: Home | Hero | More Info Button focused")
                        onContentFocused(moreInfoButtonRequester)
                    },
                    onClick = onMoreInfoClick
                )

                HeroButton(
                    label = "+ My List",
                    iconVector = Icons.Filled.Add,
                    focusRequester = myListButtonRequester,
                    leftFocusRequester = null,
                    onFocused = {
                        Log.d("FOCUS", "Screen: Home | Hero | + My List Button focused")
                        onContentFocused(myListButtonRequester)
                    },
                    onClick = { Log.d("FOCUS", "Hero: + My List clicked for ${title.title}") }
                )
            }
        }
    }
}

// ─── Hero Button ─────────────────────────────────────────────────────────────
@Composable
private fun HeroButton(
    label: String,
    iconVector: ImageVector,
    focusRequester: FocusRequester,
    leftFocusRequester: FocusRequester?,
    onFocused: () -> Unit,
    onClick: () -> Unit
) {
    var isFocused by remember { mutableStateOf(false) }

    val bgColor      = if (isFocused) Color.White else Color.White.copy(alpha = 0.18f)
    val contentColor = if (isFocused) Color(0xFF0B0B0B) else Color.White

    Surface(
        onClick = onClick,
        modifier = Modifier
            .focusRequester(focusRequester)
            .then(
                if (leftFocusRequester != null) {
                    Modifier.focusProperties { left = leftFocusRequester }
                } else Modifier
            )
            .onFocusChanged {
                isFocused = it.isFocused
                if (it.isFocused) onFocused()
            },
        shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(6.dp)),
        colors = ClickableSurfaceDefaults.colors(
            containerColor        = bgColor,
            focusedContainerColor = Color.White,
            pressedContainerColor = Color.White.copy(alpha = 0.85f)
        )
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 18.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Icon(
                imageVector = iconVector,
                contentDescription = null,
                modifier = Modifier.size(16.dp),
                tint = contentColor
            )
            Text(
                text = label,
                color = contentColor,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

// ─── Content Row (TvLazyRow with focusRestorer and stable keys) ───────────────
@Composable
private fun ContentRow(
    rowIndex: Int,
    rowTitle: String,
    items: List<MockTitle>,
    isTopTen: Boolean,
    railFocusRequester: FocusRequester,
    onCardFocused: (MockTitle, FocusRequester) -> Unit
) {
    Column {
        // Row Title: 12dp bottom gap per Bug #2
        Text(
            text = rowTitle,
            color = Color.White,
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(
                start = H_SAFE,
                top = 10.dp,
                bottom = 12.dp
            )
        )

        // TvLazyRow with focusRestorer
        TvLazyRow(
            modifier = Modifier
                .fillMaxWidth()
                .focusGroup()
                .focusRestorer(),
            contentPadding = PaddingValues(
                start = H_SAFE,
                end = H_SAFE,
                top = 14.dp,    // Space for 1.12x scale + border
                bottom = 14.dp
            ),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            itemsIndexed(items, key = { _, item -> item.id }) { itemIndex, item ->
                val cardRequester = remember { FocusRequester() }

                MovieCardItem(
                    title = item.title,
                    year = item.year,
                    rowIndex = rowIndex,
                    rowTitle = rowTitle,
                    itemIndex = itemIndex,
                    isTopTen = isTopTen,
                    rank = itemIndex + 1,
                    cardFocusRequester = cardRequester,
                    railFocusRequester = railFocusRequester,
                    onFocused = {
                        onCardFocused(item, cardRequester)
                    },
                    onClick = {
                        Log.d("FOCUS", "Screen: Home | Row $rowIndex ($rowTitle) | Item $itemIndex (${item.title}) CLICKED")
                    }
                )
            }
        }
    }
}

// ─── Movie Card Item (Performance: graphicsLayer scale, no layout re-measure) ──
@Composable
private fun MovieCardItem(
    title: String,
    year: String,
    rowIndex: Int,
    rowTitle: String,
    itemIndex: Int,
    isTopTen: Boolean,
    rank: Int,
    cardFocusRequester: FocusRequester,
    railFocusRequester: FocusRequester,
    onFocused: () -> Unit,
    onClick: () -> Unit
) {
    var isFocused by remember { mutableStateOf(false) }

    // Performance: animate scale for graphicsLayer
    val scale by animateFloatAsState(
        targetValue = if (isFocused) TvTokens.FocusedScale else 1.0f,
        animationSpec = tween(durationMillis = 150),
        label = "cardScale"
    )

    // 16:9 for default, 2:3 for Top 10
    val cardWidth  = if (isTopTen) 150.dp else 230.dp
    val cardAspect = if (isTopTen) (2f / 3f) else (16f / 9f)

    Surface(
        onClick = onClick,
        modifier = Modifier
            .width(cardWidth)
            .aspectRatio(cardAspect)
            .focusRequester(cardFocusRequester)
            .then(
                // From the first card of any row, LEFT enters the nav rail!
                if (itemIndex == 0) {
                    Modifier.focusProperties { left = railFocusRequester }
                } else Modifier
            )
            // Performance: GPU-accelerated graphicsLayer scale (no layout re-measure)
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
            }
            .then(
                if (isFocused) Modifier.border(
                    width = 3.dp,
                    color = Color.White,
                    shape = RoundedCornerShape(8.dp)
                ) else Modifier
            )
            .onFocusChanged {
                isFocused = it.isFocused
                if (it.isFocused) {
                    Log.d("FOCUS", "Screen: Home | Row $rowIndex ($rowTitle) | Item $itemIndex ($title) focused")
                    onFocused()
                }
            },
        shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(8.dp)),
        colors = ClickableSurfaceDefaults.colors(
            containerColor        = Color.Transparent,
            focusedContainerColor = Color.Transparent,
            pressedContainerColor = Color.Transparent
        )
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            // Neutral dark gradient background
            val gradient = neutralGradients[(itemIndex + rowIndex) % neutralGradients.size]
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Brush.verticalGradient(gradient))
            )

            // Top 10 rank numeral
            if (isTopTen) {
                Text(
                    text = rank.toString(),
                    color = Color.White.copy(alpha = 0.14f),
                    fontSize = 68.sp,
                    fontWeight = FontWeight.Black,
                    modifier = Modifier.align(Alignment.Center)
                )
            }

            // Title + year over bottom gradient scrim, always inside card
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomStart)
                    .background(
                        Brush.verticalGradient(
                            0f to Color.Transparent,
                            1f to Color(0xEE0B0B0B)
                        )
                    )
                    .padding(horizontal = 10.dp, vertical = 6.dp)
            ) {
                Column {
                    Text(
                        text = title,
                        color = Color.White,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = year,
                        color = Color.White.copy(alpha = 0.6f),
                        fontSize = 10.sp,
                        maxLines = 1
                    )
                }
            }
        }
    }
}
