(element
  (start_tag
    (tag_name) @signature
    (attribute
      (attribute_name) @attr-name
      (attribute_value) @attr-value) @keep-id-class)
  (#match? @keep-id-class "id|class")
  (children) @ignore)
