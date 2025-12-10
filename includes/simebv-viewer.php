<?php
if (!defined('ABSPATH')) {
    exit;
}

use Kucrut\Vite;

class SIMEBV_Viewer extends SIMEBV_Base {

    public static function init() {
        add_shortcode('simebv_viewer', [self::class, 'render_ebook_viewer']);
        add_action('wp_enqueue_scripts', [self::class, 'conditionally_enqueue_assets']);
        add_action('wp_enqueue_scripts', [self::class, 'register_javascript_translations'], 100);
        // add_action('enqueue_block_editor_assets', [self::class, 'enqueue_block_editor_assets']);
    }

    // public static function initializeFS() {
    //     $creds = request_filesystem_credentials(trailingslashit(SIMEBV_PLUGIN_URL) . 'books', '', false, SIMEBV_PLUGIN_DIR . 'books');
    //     if (!WP_Filesystem($creds)) {
    //         return false;
    //     }
    //     return true;
    // }

    public static function register_javascript_translations() {
        wp_set_script_translations(
            'simebv-viewer-lib', 'simple-ebook-viewer', SIMEBV_PLUGIN_DIR . 'languages/'
        );
    }

    public static function conditionally_enqueue_assets() {
        if (!is_singular()) {
            return;
        }

        global $post;
        if (has_shortcode($post->post_content, 'simebv_viewer')) {
            Vite\enqueue_asset(
                SIMEBV_PLUGIN_DIR . '/dist',
                'src/js/simebv-viewer.js',
                [
                    'handle' => 'simebv-viewer-lib',
                    'dependencies' => ['wp-i18n', 'wp-api'],
                    'in-footer' => true,
                ]
            );
        }

    }

    public static function render_ebook_viewer($atts) {
        // add default value for attributes in the shortcode
        $atts = shortcode_atts(
            self::shortcode_viewer_atts_with_defaults(),
            $atts,
            'simebv_viewer'
        );

        $ebook_id = '';
        $args = array(
            'post_type' => 'attachment',
            // 'post_mime_type' => 'application/epub+zip',
            'post_status' => 'inherit',
            'meta_query' => [
                [
                    'key' => 'simebv_ebook_slug',
                    'value' => sanitize_text_field($atts['book']),
                    'compare' => '=',
                ],
            ],
        );
        $query = new WP_Query($args);
        if ($query->have_posts()) {
            $query->the_post();  // used to bump to the next post retrieved by the query, usually used in a loop e.g. while ($query->have_posts()) { $query->the_post(); ... }
            $ebook_id = get_the_ID();
            wp_reset_postdata();
        }
        if (empty($ebook_id)) {
            return '<p style="color: red;">' . esc_html__("No Web Publication file provided.", 'simple-ebook-viewer') . '</p>';
        }

        $styles = self::setup_styles($atts);

        ob_start(); ?>
<section
    id="simebv-reader-container"
    data-ebook-id="<?php echo esc_attr($ebook_id); ?>"
    <?php
        echo strlen($styles['container']) !== 0 ? 'style="' . esc_attr($styles['container']) . '" ' : '';
        foreach(self::$shortcode_viewer_atts['html_attributes'] as $name => $vals) {
            echo strlen($atts[$name]) !== 0 ? $vals['html_name'] . '="' . esc_attr($atts[$name]) . '" ' : '';
        }
    ?>
    tabindex="0"
    aria-label="Ebook reader"
>
    <noscript>
        <?php esc_html_e("It seems that JavaScript is not enabled in your browser, you need to enable it in order to use the Ebook Viewer.", 'simple-ebook-viewer'); ?>
    </noscript>
</section>
        <?php
        return ob_get_clean();
    }

    public static function setup_styles($attrs) {
        $style_container = '';
        foreach (array_keys(self::$shortcode_viewer_atts['style_attributes']) as $name) {
            if (strlen($attrs[$name]) === 0) {
                continue;
            }
            if ($name === 'style') {
                $style_container .= trim($attrs[$name]);
                if (!str_ends_with($style_container, ';')) {
                    $style_container .= ';';
                }
            }
            else {
                $style_container .= $name . ':' . $attrs[$name] . ';';
            }
        }
        if (strlen($attrs['max-height'] === 0 && strlen($attrs['height']) === 0)) {
            $style_container .= "max-height:95vh;";
        }
        return [
            'container' => $style_container,
        ];
    }

    /**
     * Old method used to inject the ebook url in the HTML, superseded
     * by the use of the wp-api: now I inject in the HTML only the ebook's id.
     */
    private static function retrieve_book_url($atts) {
        // if the 'book' attribute of the shortcode is a valid url that points
        // to a file in the uploads directory, use it directly as url.
        // Otherwise, use it to do a query in the db as the value for
        // the 'simebv_ebook_slug' posts metadata.
        $file_url = wp_http_validate_url($atts['book']);
        if ($file_url) {
            $escaped_url = esc_url($file_url);
            if (!str_starts_with($escaped_url, wp_upload_dir()['baseurl']) || str_contains($escaped_url, '../')) {
                $file_url = '';
            }
        }
        if (!$file_url) {
            $args = array(
                'post_type' => 'attachment',
                // 'post_mime_type' => 'application/epub+zip',
                'post_status' => 'inherit',
                'meta_query' => [
                    [
                        'key' => 'simebv_ebook_slug',
                        'value' => sanitize_text_field($atts['book']),
                        'compare' => '=',
                    ],
                ],
            );
            $query = new WP_Query($args);
            if ($query->have_posts()) {
                $query->the_post();  // used to bump to the next post retrieved by the query, usually used in a loop e.g. while ($query->have_posts()) { $query->the_post(); ... }
                $attachment_ID = get_the_ID();
                wp_reset_postdata();
                $file_url = wp_get_attachment_url($attachment_ID);
            }
        }
        return $file_url;
    }

}
