package airqo.models;

import lombok.*;

import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@ToString
public class BrokerMessage<T> {
	private List<T> data;
	private BrokerMessageAction action;
}
