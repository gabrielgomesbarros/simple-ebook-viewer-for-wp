<?php
if (!defined('ABSPATH')) {
    exit;
}


class SIMEBV_Base {

    public static $ebook_mimetypes = [
        'epub' => 'application/epub+zip',
        'cbz' => 'application/vnd.comicbook+zip',
        'fb2' => 'application/x-fictionbook+xml',
        'fbz' => 'application/x-zip-compressed-fb2',
        'mobi' => 'application/x-mobipocket-ebook',
        'azw' => 'application/vnd.amazon.ebook',
        'azw3' => 'application/vnd.amazon.ebook',
    ];

    public static $shortcode_viewer_atts = [
        'book_attributes' => [
            'book' => '',
        ],
        'style_attributes' => [
            'height' => '',
            'width' => '',
            'max-height' => '',
            'max-width' => '',
            'border' => '',
            'style' => '',
        ],
        'html_attributes' => [
            'class' => [
                'html_name' => 'class', 'default' => ''
            ],
            'max-pages' => [
                'html_name' => 'data-simebv-maxpages', 'default' => ''
            ],
            'color-scheme' => [
                'html_name' => 'data-simebv-colors', 'default' => ''
            ],
            'zoom' => [
                'html_name' => 'data-simebv-zoom', 'default' => ''
            ],
            'layout' => [
                'html_name' => 'data-simebv-layout', 'default' => ''
            ],
            'default-font-size' => [
                'html_name' => 'data-simebv-fontsize', 'default' => ''
            ],
            'font-family' => [
                'html_name' => 'data-simebv-font-family', 'default' => ''
            ],
            'page-margins' => [
                'html_name' => 'data-simebv-margins', 'default' => ''
            ],
            'activate-color-filter' => [
                'html_name' => 'data-simebv-activatecolorfilter', 'default' => ''
            ],
            'invert-color-filter' => [
                'html_name' => 'data-simebv-invertcolorsfilter', 'default' => ''
            ],
            'rotate-color-filter' => [
                'html_name' => 'data-simebv-rotatecolorsfilter', 'default' => ''
            ],
            'bg-transparent-filter' => [
                'html_name' => 'data-simebv-bgfiltertransparent', 'default' => ''
            ],
            'bg-color-filter' => [
                'html_name' => 'data-simebv-bgcolors-filter', 'default' => ''
            ],
            'always-full-viewport' => [
                'html_name' => 'data-simebv-always-full-viewport', 'default' => 'false'
            ],
            'show-close-button' => [
                'html_name' => 'data-simebv-show-close-button', 'default' => 'false'
            ],
            'return-to-url' => [
                'html_name' => 'data-simebv-return-to-url', 'default' => ''
            ],
            'real-fullscreen' => [
                'html_name' => 'data-simebv-real-fullscreen', 'default' => 'false'
            ],
            'allow-js' => [
                'html_name' => 'data-simebv-allow-js', 'default' => 'false'
            ],
            'ebook-title' => [
                'html_name' => 'data-simebv-ebook-title', 'default' => ''
            ],
            'ebook-author' => [
                'html_name' => 'data-simebv-ebook-author', 'default' => ''
            ],
            'show-annotations' => [
                'html_name' => 'data-simebv-show-annotations', 'default' => 'true'
            ],
            'show-page-delimiters' => [
                'html_name' => 'data-simebv-show-page-delimiters', 'default' => 'true'
            ],
        ],
    ];

    public static function shortcode_viewer_atts_with_defaults() {
        return array_merge(
            self::$shortcode_viewer_atts['book_attributes'],
            self::$shortcode_viewer_atts['style_attributes'],
            array_map(
                fn($item) => $item['default'],
                self::$shortcode_viewer_atts['html_attributes']
            ),
        );
    }
}
