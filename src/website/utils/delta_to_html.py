# backend/utils/delta_to_html.py

import json
from django.utils.html import escape
from typing import Dict, List, Any, Tuple
import re

def delta_to_html(delta: Any) -> str:
    """
    Convert a Quill Delta JSON object to sanitized HTML.

    Args:
        delta (Any): A JSON string or dictionary representing Quill Delta.

    Returns:
        str: The generated sanitized HTML from the Quill Delta.
    """
    try:
        if not delta:
            return ""

        # Parse delta if it's a JSON string
        if isinstance(delta, str):
            delta = json.loads(delta)
        
        # Validate delta structure
        if not isinstance(delta, dict) or 'ops' not in delta:
            return ""

        ops = delta['ops']
        html = []
        list_stack: List[Tuple[str, int]] = []  # Stack to manage nested lists: (list_type, indent_level)
        current_block: Dict[str, Any] = {'type': 'p', 'attrs': {}, 'content': ''}

        for op in ops:
            insert = op.get('insert', '')
            attributes = op.get('attributes', {})

            if isinstance(insert, dict):
                # Process the current block before handling the embed
                html.append(process_block(current_block, list_stack))
                current_block = {'type': 'p', 'attrs': {}, 'content': ''}
                # Process the embed (e.g., image, video)
                embed_html = process_embed(insert, attributes)
                html.append(embed_html)
                continue

            # Split the insert text by '\n' to handle block-level formatting
            lines = re.split(r'(\n)', insert)
            for part in lines:
                if part == '\n':
                    # Process the current block with its attributes
                    html.append(process_block(current_block, list_stack))
                    # Determine the new block type based on attributes
                    current_block = determine_block_type(attributes)
                else:
                    # Append formatted inline text to the current block content
                    formatted_text = format_inline(part, attributes)
                    current_block['content'] += formatted_text

        # After processing all ops, append any remaining content
        html.append(process_block(current_block, list_stack))

        # Close any remaining open lists
        while list_stack:
            html.append(close_list(list_stack.pop()))

        return ''.join(html)

    except Exception as e:
        print(f"Error in delta_to_html: {str(e)}")
        return ""

def determine_block_type(attributes: Dict[str, Any]) -> Dict[str, Any]:
    """
    Determine the block type and its attributes based on the given attributes.

    Args:
        attributes (Dict[str, Any]): Attributes from the Delta operation.

    Returns:
        Dict[str, Any]: A dictionary with block 'type', 'attrs', and 'content'.
    """
    if 'header' in attributes:
        return {'type': f'h{attributes["header"]}', 'attrs': attributes, 'content': ''}
    elif 'list' in attributes:
        return {'type': 'li', 'attrs': attributes, 'content': ''}
    elif 'blockquote' in attributes:
        return {'type': 'blockquote', 'attrs': attributes, 'content': ''}
    elif 'code-block' in attributes:
        return {'type': 'pre', 'attrs': attributes, 'content': ''}
    elif 'align' in attributes or 'indent' in attributes:
        # Block-level styles
        return {'type': 'p', 'attrs': attributes, 'content': ''}
    else:
        return {'type': 'p', 'attrs': attributes, 'content': ''}

def process_block(block: Dict[str, Any], list_stack: List[Tuple[str, int]]) -> str:
    """
    Process a block and return the corresponding HTML.

    Args:
        block (Dict[str, Any]): The current block with 'type', 'attrs', 'content'.
        list_stack (List[Tuple[str, int]]): Stack to manage nested lists.

    Returns:
        str: HTML string for the block.
    """
    try:
        block_type = block['type']
        attrs = block['attrs']
        content = block['content']

        if block_type == 'li':
            return handle_list_item(block, list_stack)
        else:
            # Close any open lists if current block is not a list item
            while list_stack and block_type != 'li':
                list_type, _ = list_stack.pop()
                html = close_list(list_type)
                content = wrap_block(content, block_type, attrs)
                return html + content
            return wrap_block(content, block_type, attrs)
    except Exception as e:
        print(f"Error in process_block: {str(e)}")
        return ""

def handle_list_item(block: Dict[str, Any], list_stack: List[Tuple[str, int]]) -> str:
    """
    Handle a list item, managing the list stack for nested lists.

    Args:
        block (Dict[str, Any]): The current block with 'type' == 'li', 'attrs', 'content'.
        list_stack (List[Tuple[str, int]]): Stack to manage nested lists.

    Returns:
        str: HTML string for the list item, including opening or closing list tags if necessary.
    """
    try:
        list_type = block['attrs'].get('list', 'bullet')  # 'bullet' or 'ordered'
        list_tag = 'ul' if list_type == 'bullet' else 'ol'
        indent_level = block['attrs'].get('indent', 0)

        # Check the current stack to see if we need to open a new list
        if not list_stack or list_stack[-1][0] != list_type or list_stack[-1][1] < indent_level:
            # Open a new nested list
            html = f'<{list_tag}>'
            list_stack.append((list_type, indent_level))
        elif list_stack[-1][1] > indent_level:
            # Close lists until we reach the correct level or type
            html = ''
            while list_stack and list_stack[-1][1] > indent_level:
                closed_list_type, _ = list_stack.pop()
                html += close_list(closed_list_type)
            # If the current list type is different, open a new list
            if list_stack and list_stack[-1][0] != list_type:
                html += f'<{list_tag}>'
                list_stack.append((list_type, indent_level))
            else:
                html += ''
        else:
            # Same list type and indent level, no need to open a new list
            html = ''

        # Format the list item
        list_item_html = wrap_block(block['content'], 'li', block['attrs'])

        return html + list_item_html
    except Exception as e:
        print(f"Error in handle_list_item: {str(e)}")
        return ""

def close_list(list_type: str) -> str:
    """
    Return the closing tag for a list.

    Args:
        list_type (str): 'bullet' or 'ordered'

    Returns:
        str: The closing tag </ul> or </ol>.
    """
    list_tag = 'ul' if list_type == 'bullet' else 'ol'
    return f'</{list_tag}>'

def format_inline(text: str, attributes: Dict[str, Any]) -> str:
    """
    Apply inline formatting to text based on attributes.

    Args:
        text (str): The text to format.
        attributes (Dict[str, Any]): Attributes from the Delta operation.

    Returns:
        str: Formatted HTML string.
    """
    try:
        if not text:
            return ''

        result = escape(text)
        # Preserve multiple spaces by replacing them with &nbsp;
        result = re.sub('  ', '&nbsp;&nbsp;', result)

        # Apply inline formats
        if attributes.get('code'):
            result = f'<code>{result}</code>'
        if attributes.get('bold'):
            result = f'<strong>{result}</strong>'
        if attributes.get('italic'):
            result = f'<em>{result}</em>'
        if attributes.get('underline'):
            result = f'<u>{result}</u>'
        if attributes.get('strike'):
            result = f'<s>{result}</s>'
        if attributes.get('script') == 'super':
            result = f'<sup>{result}</sup>'
        elif attributes.get('script') == 'sub':
            result = f'<sub>{result}</sub>'
        if 'link' in attributes:
            href = escape(attributes['link'])
            result = f'<a href="{href}" target="_blank">{result}</a>'

        # Handle inline styles
        styles = []
        if 'color' in attributes:
            styles.append(f'color: {attributes["color"]};')
        if 'background' in attributes:
            styles.append(f'background-color: {attributes["background"]};')
        if 'font' in attributes:
            styles.append(f'font-family: {attributes["font"]};')
        if 'size' in attributes:
            # Quill size can be 'small', 'large', 'huge' or a font size in pixels
            size = attributes['size']
            if isinstance(size, int):
                styles.append(f'font-size: {size}px;')
            elif size in ['small', 'large', 'huge']:
                size_map = {'small': '12px', 'large': '18px', 'huge': '24px'}
                styles.append(f'font-size: {size_map.get(size, "16px")};')
            else:
                styles.append(f'font-size: {size};')

        if styles:
            style_str = ' '.join(styles)
            result = f'<span style="{style_str}">{result}</span>'

        return result
    except Exception as e:
        print(f"Error in format_inline: {str(e)}")
        return escape(text)

def wrap_block(content: str, tag: str, attributes: Dict[str, Any]) -> str:
    """
    Wrap content in a block-level HTML tag with styles.

    Args:
        content (str): The content to wrap.
        tag (str): The HTML tag (e.g., 'p', 'h1', 'blockquote', 'pre').
        attributes (Dict[str, Any]): Attributes from the Delta operation.

    Returns:
        str: The wrapped HTML string.
    """
    try:
        block_styles = []
        classes = []

        if 'align' in attributes:
            block_styles.append(f'text-align: {attributes["align"]};')
        if 'direction' in attributes:
            block_styles.append(f'direction: {attributes["direction"]};')
        if 'indent' in attributes and tag != 'li':
            indent_level = attributes['indent']
            block_styles.append(f'margin-left: {indent_level * 1.5}em;')

        # Specific handling for code blocks
        if tag == 'pre':
            classes.append('ql-syntax')

        # Build style and class attributes
        style_attr = f' style="{" ".join(block_styles)}"' if block_styles else ''
        class_attr = f' class="{" ".join(classes)}"' if classes else ''

        return f'<{tag}{class_attr}{style_attr}>{content}</{tag}>'
    except Exception as e:
        print(f"Error in wrap_block: {str(e)}")
        return content

def process_embed(insert: Dict[str, Any], attributes: Dict[str, Any]) -> str:
    """
    Process embedded content like images and videos.

    Args:
        insert (Dict[str, Any]): The embed dict from the Delta operation.
        attributes (Dict[str, Any]): Attributes from the Delta operation.

    Returns:
        str: HTML string for the embed.
    """
    try:
        if 'image' in insert:
            return format_image(insert['image'], attributes)
        elif 'video' in insert:
            return format_video(insert['video'], attributes)
        # Handle other embeds if necessary
        return ''
    except Exception as e:
        print(f"Error in process_embed: {str(e)}")
        return ''

def format_image(image_url: str, attributes: Dict[str, Any]) -> str:
    """
    Format an image embed into HTML.

    Args:
        image_url (str): The URL of the image.
        attributes (Dict[str, Any]): Attributes from the Delta operation.

    Returns:
        str: HTML string for the image.
    """
    try:
        attrs = [f'src="{escape(image_url)}"']
        if 'alt' in attributes:
            attrs.append(f'alt="{escape(attributes["alt"])}"')
        if 'width' in attributes:
            attrs.append(f'width="{attributes["width"]}"')
        if 'height' in attributes:
            attrs.append(f'height="{attributes["height"]}"')
        
        # Handle image styles
        styles = []
        if 'align' in attributes:
            styles.append(f'text-align: {attributes["align"]};')
        if 'indent' in attributes:
            indent_level = attributes['indent']
            styles.append(f'margin-left: {indent_level * 1.5}em;')
        if 'style' in attributes:
            styles.append(attributes['style'])

        style_attr = f' style="{" ".join(styles)}"' if styles else ''

        return f'<img {" ".join(attrs)}{style_attr}>'
    except Exception as e:
        print(f"Error in format_image: {str(e)}")
        return ''

def format_video(video_url: str, attributes: Dict[str, Any]) -> str:
    """
    Format a video embed into HTML.

    Args:
        video_url (str): The URL of the video.
        attributes (Dict[str, Any]): Attributes from the Delta operation.

    Returns:
        str: HTML string for the video.
    """
    try:
        attrs = [f'src="{escape(video_url)}"', 'frameborder="0"', 'allowfullscreen']
        if 'width' in attributes:
            attrs.append(f'width="{attributes["width"]}"')
        if 'height' in attributes:
            attrs.append(f'height="{attributes["height"]}"')
        
        # Handle video styles
        styles = []
        if 'align' in attributes:
            styles.append(f'text-align: {attributes["align"]};')
        if 'indent' in attributes:
            indent_level = attributes['indent']
            styles.append(f'margin-left: {indent_level * 1.5}em;')
        if 'style' in attributes:
            styles.append(attributes['style'])

        style_attr = f' style="{" ".join(styles)}"' if styles else ''

        return f'<iframe {" ".join(attrs)}{style_attr}></iframe>'
    except Exception as e:
        print(f"Error in format_video: {str(e)}")
        return ''
