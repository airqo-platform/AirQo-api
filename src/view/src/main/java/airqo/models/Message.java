package airqo.models;

import lombok.*;

import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@ToString
public class Message<T> {
	private List<T> data;
	private MessageAction action;
}
