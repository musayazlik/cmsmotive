import type { PuckComponent } from "@puckeditor/core";
import { blockAttributes } from "../shared";
import type { ListProps } from "./schema";

export const ListRender: PuckComponent<ListProps> = ({ listStyle, items, id, lang, ariaLabel }) => {
  const Tag = listStyle === "number" ? "ol" : "ul";

  return (
    <div data-pb={id} {...blockAttributes({ id, lang, ariaLabel })} className={`pb-list pb-list--${listStyle}`}>
      <Tag className="pb-list-body">
        {items.map((item, index) => (
          <li key={item.id ?? index} className="pb-list-item">
            {listStyle === "check" ? (
              <span className="pb-list-check" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            ) : null}
            <span className="pb-list-text">{item.text}</span>
          </li>
        ))}
      </Tag>
    </div>
  );
};
